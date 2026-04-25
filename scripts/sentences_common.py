from __future__ import annotations

import hashlib
import html
import io
import re
import sqlite3
import subprocess
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator
from urllib.parse import quote

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PUBLIC_AUDIO_BASE_URL = "https://jitori-storage.davidmartins.net"
DEFAULT_ANKI_DECK_PATH = PROJECT_ROOT / "Ankidrone Sentence Pack V4.apkg"

FIELD_SEPARATOR = "\x1f"
HTML_BREAK_RE = re.compile(r"(?i)<br\s*/?>")
HTML_TAG_RE = re.compile(r"<[^>]+>")
AUDIO_TAG_RE = re.compile(r"\[sound:(.+?)\]", re.IGNORECASE)
AUXILIARY_SOURCE_TAGS = {"nihongoshark", "validated", "tatoeba"}
IGNORED_LEVEL_TAG_RE = re.compile(r"^jlpt\d+$", re.IGNORECASE)


@dataclass(frozen=True)
class AnkiMediaEntry:
	filename: str
	member_name: str
	checksum: str


def default_sentence_input_path() -> Path:
	return DEFAULT_ANKI_DECK_PATH


def validate_sentence_input_path(path: Path) -> Path:
	resolved_path = path.resolve()
	if resolved_path.suffix.lower() != ".apkg":
		raise ValueError(f"Sentence source must be an .apkg deck: {resolved_path}")
	if not resolved_path.exists():
		raise FileNotFoundError(f"Anki deck not found: {resolved_path}")
	return resolved_path


def iter_normalized_sentences(input_path: Path, public_audio_base_url: str) -> Iterator[dict]:
	with AnkiDeckArchive(validate_sentence_input_path(input_path)) as deck:
		yield from deck.iter_normalized_sentences(public_audio_base_url)


def build_normalized_sentence_record(
	*,
	source: str,
	audio_path: str,
	sentence: str,
	translation: str,
	public_audio_base_url: str,
	word: str = "",
	word_definition: str = ""
) -> dict:
	normalized_audio_path = audio_path.lstrip("/")
	return {
		"id": build_sentence_id(
			audio_path=normalized_audio_path,
			sentence=sentence,
			translation=translation,
			source=source
		),
		"source": source,
		"audio_path": normalized_audio_path,
		"audio_url": build_public_audio_url(normalized_audio_path, public_audio_base_url) if normalized_audio_path else "",
		"sentence": sentence.strip(),
		"translation": translation.strip(),
		"word": word.strip(),
		"word_definition": word_definition.strip()
	}


def build_sentence_id(audio_path: str, sentence: str = "", translation: str = "", source: str = "") -> str:
	identity = audio_path or "\n".join((source.strip(), sentence.strip(), translation.strip()))
	return hashlib.sha1(identity.encode("utf-8")).hexdigest()


def build_public_audio_url(audio_path: str, public_audio_base_url: str) -> str:
	base = public_audio_base_url.rstrip("/")
	return f"{base}/{quote(audio_path.lstrip('/'), safe='/')}"


def strip_html(value: str) -> str:
	with_breaks = HTML_BREAK_RE.sub("\n", value)
	stripped = HTML_TAG_RE.sub("", with_breaks)
	normalized = html.unescape(stripped).replace("\xa0", " ")
	return "\n".join(line.strip() for line in normalized.splitlines() if line.strip())


def extract_audio_filenames(value: str) -> list[str]:
	return [
		html.unescape(match.group(1)).strip()
		for match in AUDIO_TAG_RE.finditer(value)
		if match.group(1).strip()
	]


def choose_sentence_source(tags: str, audio_filenames: list[str]) -> str:
	normalized_tags = [token.strip() for token in tags.split() if token.strip()]
	candidates = [
		token
		for token in normalized_tags
		if token not in AUXILIARY_SOURCE_TAGS and not IGNORED_LEVEL_TAG_RE.match(token)
	]
	tatoeba_variants = [token for token in candidates if token.startswith("tatoeba/")]
	if tatoeba_variants:
		return tatoeba_variants[0]
	if candidates:
		return max(candidates, key=lambda token: (token.count("/"), len(token), token))
	if normalized_tags:
		return max(normalized_tags, key=lambda token: (token.count("/"), len(token), token))
	if audio_filenames:
		audio_name = audio_filenames[0]
		if "_" in audio_name:
			return audio_name.split("_", 1)[0]
		return Path(audio_name).stem
	return ""


def read_varint(payload: bytes, offset: int) -> tuple[int, int]:
	shift = 0
	result = 0
	while True:
		if offset >= len(payload):
			raise ValueError("Unexpected end of protobuf payload while reading varint")
		byte = payload[offset]
		offset += 1
		result |= (byte & 0x7F) << shift
		if not (byte & 0x80):
			return result, offset
		shift += 7


def parse_anki_media_entry(payload: bytes) -> AnkiMediaEntry:
	offset = 0
	filename = ""
	member_index: int | None = None
	checksum = ""
	while offset < len(payload):
		tag, offset = read_varint(payload, offset)
		field_number = tag >> 3
		wire_type = tag & 0x07
		if wire_type == 0:
			value, offset = read_varint(payload, offset)
			if field_number == 2:
				member_index = value
			continue
		if wire_type != 2:
			raise ValueError(f"Unsupported media manifest wire type: {wire_type}")
		length, offset = read_varint(payload, offset)
		chunk = payload[offset:offset + length]
		offset += length
		if field_number == 1:
			filename = chunk.decode("utf-8")
		elif field_number == 3:
			checksum = chunk.hex()
	if not filename or member_index is None:
		raise ValueError("Media manifest entry is missing required fields")
	return AnkiMediaEntry(filename=filename, member_name=str(member_index), checksum=checksum)


def parse_anki_media_manifest(payload: bytes) -> dict[str, AnkiMediaEntry]:
	offset = 0
	entries: dict[str, AnkiMediaEntry] = {}
	while offset < len(payload):
		tag, offset = read_varint(payload, offset)
		field_number = tag >> 3
		wire_type = tag & 0x07
		if field_number != 1 or wire_type != 2:
			raise ValueError("Unexpected top-level media manifest structure")
		length, offset = read_varint(payload, offset)
		chunk = payload[offset:offset + length]
		offset += length
		entry = parse_anki_media_entry(chunk)
		entries[entry.filename] = entry
	return entries


def decompress_zstd_file(source_path: Path, destination_path: Path) -> None:
	try:
		import zstandard
	except ImportError:
		subprocess.run(
			["zstd", "-d", "-q", "-o", str(destination_path), str(source_path)],
			check=True,
			stdout=subprocess.DEVNULL,
			stderr=subprocess.DEVNULL
		)
		return

	dctx = zstandard.ZstdDecompressor()
	with source_path.open("rb") as source_handle, destination_path.open("wb") as destination_handle:
		dctx.copy_stream(source_handle, destination_handle)


def decompress_zstd_bytes(payload: bytes) -> bytes:
	try:
		import zstandard
	except ImportError:
		with tempfile.TemporaryDirectory() as temp_dir:
			source_path = Path(temp_dir) / "payload.zst"
			destination_path = Path(temp_dir) / "payload.out"
			source_path.write_bytes(payload)
			decompress_zstd_file(source_path, destination_path)
			return destination_path.read_bytes()
	buffer = io.BytesIO()
	with zstandard.ZstdDecompressor().stream_reader(io.BytesIO(payload)) as reader:
		while True:
			chunk = reader.read(65536)
			if not chunk:
				break
			buffer.write(chunk)
	return buffer.getvalue()


class AnkiDeckArchive:
	def __init__(self, deck_path: Path) -> None:
		self.deck_path = deck_path
		self.archive: zipfile.ZipFile | None = None
		self.temp_dir: tempfile.TemporaryDirectory[str] | None = None
		self.db_path: Path | None = None
		self.connection: sqlite3.Connection | None = None
		self.field_names_by_model: dict[int, list[str]] = {}
		self.media_entries_by_filename: dict[str, AnkiMediaEntry] = {}

	def __enter__(self) -> AnkiDeckArchive:
		self.archive = zipfile.ZipFile(self.deck_path, "r")
		self.temp_dir = tempfile.TemporaryDirectory()
		self.db_path = self._prepare_database(Path(self.temp_dir.name))
		self.connection = sqlite3.connect(str(self.db_path), check_same_thread=False)
		self.field_names_by_model = self._load_field_names()
		self.media_entries_by_filename = self._load_media_entries()
		return self

	def __exit__(self, exc_type, exc, tb) -> None:
		if self.connection is not None:
			self.connection.close()
			self.connection = None
		if self.temp_dir is not None:
			self.temp_dir.cleanup()
			self.temp_dir = None
		if self.archive is not None:
			self.archive.close()
			self.archive = None

	def iter_normalized_sentences(self, public_audio_base_url: str) -> Iterator[dict]:
		if self.connection is None:
			raise RuntimeError("Anki deck archive is not open")
		rows = self.connection.execute("SELECT mid, tags, flds FROM notes ORDER BY id ASC")
		for model_id, tags, field_blob in rows:
			field_names = self.field_names_by_model.get(int(model_id), [])
			if not field_names:
				continue
			values = field_blob.split(FIELD_SEPARATOR)
			fields = {
				name: values[index] if index < len(values) else ""
				for index, name in enumerate(field_names)
			}
			sentence = strip_html(fields.get("SentKanji", ""))
			translation = strip_html(fields.get("SentEng", ""))
			audio_filenames = extract_audio_filenames(fields.get("SentAudio", ""))
			audio_path = audio_filenames[0] if audio_filenames else ""
			if not sentence or not translation:
				continue
			yield build_normalized_sentence_record(
				source=choose_sentence_source(tags, audio_filenames),
				audio_path=audio_path,
				sentence=sentence,
				translation=translation,
				public_audio_base_url=public_audio_base_url,
				word=strip_html(fields.get("VocabKanji", "")),
				word_definition=strip_html(fields.get("VocabDef", ""))
			)

	def extract_media_file(self, filename: str, destination_path: Path) -> None:
		if self.archive is None:
			raise RuntimeError("Anki deck archive is not open")
		entry = self.media_entries_by_filename.get(filename)
		if entry is None:
			raise FileNotFoundError(f"Media file is not present in the deck: {filename}")
		if destination_path.exists() and destination_path.stat().st_size > 0:
			return
		destination_path.parent.mkdir(parents=True, exist_ok=True)
		compressed_payload = self.archive.read(entry.member_name)
		destination_path.write_bytes(decompress_zstd_bytes(compressed_payload))

	def _prepare_database(self, temp_root: Path) -> Path:
		if self.archive is None:
			raise RuntimeError("Anki deck archive is not open")
		if "collection.anki21b" in self.archive.namelist():
			compressed_db = Path(self.archive.extract("collection.anki21b", str(temp_root)))
			database_path = temp_root / "collection.anki21"
			decompress_zstd_file(compressed_db, database_path)
			return database_path
		for member_name in ("collection.anki21", "collection.anki2"):
			if member_name in self.archive.namelist():
				return Path(self.archive.extract(member_name, str(temp_root)))
		raise FileNotFoundError("No supported Anki collection database found in deck")

	def _load_field_names(self) -> dict[int, list[str]]:
		if self.connection is None:
			raise RuntimeError("Anki deck archive is not open")
		mapping: dict[int, list[str]] = {}
		for model_id, field_order, field_name in self.connection.execute(
			"SELECT ntid, ord, name FROM fields ORDER BY ntid ASC, ord ASC"
		):
			fields = mapping.setdefault(int(model_id), [])
			index = int(field_order)
			while len(fields) <= index:
				fields.append("")
			fields[index] = str(field_name)
		return mapping

	def _load_media_entries(self) -> dict[str, AnkiMediaEntry]:
		if self.archive is None:
			raise RuntimeError("Anki deck archive is not open")
		if "media" not in self.archive.namelist():
			return {}
		compressed_payload = self.archive.read("media")
		return parse_anki_media_manifest(decompress_zstd_bytes(compressed_payload))
