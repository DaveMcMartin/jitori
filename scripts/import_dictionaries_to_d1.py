from __future__ import annotations

import argparse
import json
import os
import sys
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal, Any

try:
	import tomllib
except ImportError:
	try:
		import tomli as tomllib
	except ImportError:
		tomllib = None

from d1_client import D1Config, execute_sql, execute_sql_file


@dataclass(frozen=True)
class JMDictImportItem:
	item_id: str
	ent_seq: int
	primary_kanji: str
	primary_reading: str
	gloss: str
	parts_of_speech: list[str]
	terms_kanji: list[str]
	terms_reading: list[str]


@dataclass(frozen=True)
class KanjidictImportItem:
	item_id: str
	literal: str
	grade: int | None
	jlpt: int | None
	stroke_count: int | None
	frequency: int | None
	on_readings: list[str]
	kun_readings: list[str]
	nanori: list[str]
	meanings: list[str]


ImportItem = JMDictImportItem | KanjidictImportItem


def load_wrangler_config() -> dict[str, str]:
	config = {}
	wrangler_toml = Path(__file__).resolve().parent.parent / "wrangler.toml"
	if not wrangler_toml.exists() or tomllib is None:
		return config

	try:
		with wrangler_toml.open("rb") as f:
			data = tomllib.load(f)
			for db in data.get("d1_databases", []):
				if db.get("binding") == "DB":
					config["database_id"] = db.get("database_id")
					break
	except Exception as e:
		print(f"Warning: Failed to load wrangler.toml: {e}", file=sys.stderr)

	return config


def parse_args() -> argparse.Namespace:
	wrangler_config = load_wrangler_config()
	parser = argparse.ArgumentParser(description="Import JMdict and KANJIDICT into Cloudflare D1.")
	parser.add_argument("--jmdict-zip", type=Path, default=Path("JMdict_english.zip"))
	parser.add_argument("--kanjidict-zip", type=Path, default=Path("KANJIDIC_english.zip"))
	parser.add_argument("--account-id", default=os.environ.get("CLOUDFLARE_ACCOUNT_ID", ""))
	parser.add_argument(
		"--database-id",
		default=os.environ.get(
			"CLOUDFLARE_D1_DATABASE_ID", wrangler_config.get("database_id", "")
		)
	)
	parser.add_argument("--api-token", default=os.environ.get("CLOUDFLARE_API_TOKEN", ""))
	parser.add_argument("--local", action="store_true", help="Run against local D1 database")
	parser.add_argument("--scope", choices=("all", "jmdict", "kanjidict"), default="all")
	parser.add_argument("--entries-per-chunk", type=int, default=50000)
	return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
	missing = []
	if not args.database_id:
		missing.append("database-id")
	
	import subprocess
	try:
		subprocess.run(["npx", "wrangler", "--version"], capture_output=True, check=True)
	except Exception:
		if not args.api_token:
			missing.append("api-token (or npx wrangler)")

	if missing:
		raise SystemExit(f"Missing required D1 settings: {', '.join(missing)}")
	
	if args.scope in {"all", "jmdict"} and not args.jmdict_zip.exists():
		root_jmdict = Path(__file__).resolve().parent.parent / "JMdict_english.zip"
		if root_jmdict.exists():
			args.jmdict_zip = root_jmdict
	
	if args.scope in {"all", "kanjidict"} and not args.kanjidict_zip.exists():
		root_kanji = Path(__file__).resolve().parent.parent / "KANJIDIC_english.zip"
		if root_kanji.exists():
			args.kanjidict_zip = root_kanji


def escape_sql(value: str) -> str:
	return value.replace("'", "''")


def unique(items: Iterable[Any]) -> list[Any]:
	seen: set[Any] = set()
	result: list[Any] = []
	for item in items:
		if not item:
			continue
		key = str(item) if isinstance(item, (list, dict)) else item
		if key not in seen:
			seen.add(key)
			result.append(item)
	return result


def stringify_gloss(gloss: Any) -> str:
	if isinstance(gloss, str):
		return gloss
	if isinstance(gloss, list):
		return " ".join(stringify_gloss(item) for item in gloss)
	if isinstance(gloss, dict):
		return str(gloss.get("text", gloss.get("content", str(gloss))))
	return str(gloss)


def parse_int(value: str | None) -> int | None:
	if value is None:
		return None
	try:
		text = str(value).strip()
		if not text:
			return None
		return int(text)
	except ValueError:
		return None


def read_zip_member(zip_path: Path, preferred_tokens: tuple[str, ...], extension: str) -> tuple[zipfile.ZipFile, str]:
	archive = zipfile.ZipFile(zip_path, "r")
	member_names = archive.namelist()
	for token in preferred_tokens:
		for name in member_names:
			if token.lower() in name.lower() and name.lower().endswith(extension):
				return archive, name
	for name in member_names:
		if name.lower().endswith(extension):
			return archive, name
	archive.close()
	raise RuntimeError(f"No {extension} file found in archive: {zip_path}")


def parse_jmdict_items(zip_path: Path) -> list[JMDictImportItem]:
	try:
		archive, member_name = read_zip_member(zip_path, ("jmdict", "jmdict_e"), ".xml")
		return parse_jmdict_xml(archive, member_name)
	except RuntimeError:
		return parse_jmdict_yomitan(zip_path)


def parse_jmdict_xml(archive: zipfile.ZipFile, member_name: str) -> list[JMDictImportItem]:
	try:
		with archive.open(member_name) as handle:
			items: list[JMDictImportItem] = []
			for event, elem in ET.iterparse(handle, events=("end",)):
				if event != "end" or elem.tag != "entry":
					continue
				ent_seq_text = elem.findtext("ent_seq", default="0")
				ent_seq = parse_int(ent_seq_text)
				if not ent_seq:
					elem.clear()
					continue
				terms_kanji = unique((value.text or "").strip() for value in elem.findall("k_ele/keb"))
				terms_reading = unique((value.text or "").strip() for value in elem.findall("r_ele/reb"))
				sense_nodes = elem.findall("sense")
				glosses: list[str] = []
				parts_of_speech: list[str] = []
				for sense in sense_nodes:
					for pos in sense.findall("pos"):
						text = (pos.text or "").strip()
						if text:
							parts_of_speech.append(text)
					for gloss in sense.findall("gloss"):
						lang = gloss.attrib.get("{http://www.w3.org/XML/1998/namespace}lang", "").strip().lower()
						if lang and lang != "eng":
							continue
						text = (gloss.text or "").strip()
						if text:
							glosses.append(text)
				primary_kanji = terms_kanji[0] if terms_kanji else (terms_reading[0] if terms_reading else "")
				primary_reading = terms_reading[0] if terms_reading else primary_kanji
				item = JMDictImportItem(
					item_id=f"jmdict:{ent_seq}",
					ent_seq=ent_seq,
					primary_kanji=primary_kanji,
					primary_reading=primary_reading,
					gloss="; ".join(unique(glosses)),
					parts_of_speech=unique(parts_of_speech),
					terms_kanji=terms_kanji,
					terms_reading=terms_reading
				)
				items.append(item)
				elem.clear()
			return items
	finally:
		archive.close()


def parse_jmdict_yomitan(zip_path: Path) -> list[JMDictImportItem]:
	print(f"Parsing JMdict from Yomitan format: {zip_path}", file=sys.stderr)
	items_by_seq: dict[int, dict[str, Any]] = {}
	
	with zipfile.ZipFile(zip_path, "r") as archive:
		for name in archive.namelist():
			if not (name.startswith("term_bank_") and name.endswith(".json")):
				continue
			
			with archive.open(name) as handle:
				data = json.load(handle)
				for entry in data:
					if len(entry) < 8:
						continue
					
					kanji = entry[0]
					reading = entry[1]
					glosses = entry[5]
					ent_seq = entry[6]
					tags = entry[7].split() if isinstance(entry[7], str) else []
					
					if not isinstance(ent_seq, int) or ent_seq <= 0:
						continue
						
					if ent_seq not in items_by_seq:
						items_by_seq[ent_seq] = {
							"ent_seq": ent_seq,
							"kanji": [],
							"reading": [],
							"glosses": [],
							"pos": []
						}
					
					d = items_by_seq[ent_seq]
					if kanji: d["kanji"].append(kanji)
					if reading: d["reading"].append(reading)
					d["glosses"].extend(glosses)
					d["pos"].extend(tags)

	result: list[JMDictImportItem] = []
	for seq, d in items_by_seq.items():
		terms_kanji = unique(d["kanji"])
		terms_reading = unique(d["reading"])
		primary_kanji = terms_kanji[0] if terms_kanji else (terms_reading[0] if terms_reading else "")
		primary_reading = terms_reading[0] if terms_reading else primary_kanji
		
		item = JMDictImportItem(
			item_id=f"jmdict:{seq}",
			ent_seq=seq,
			primary_kanji=primary_kanji,
			primary_reading=primary_reading,
			gloss="; ".join(unique(stringify_gloss(g) for g in d["glosses"])),
			parts_of_speech=unique(d["pos"]),
			terms_kanji=terms_kanji,
			terms_reading=terms_reading
		)
		result.append(item)
	return result


def parse_kanjidict_items(zip_path: Path) -> list[KanjidictImportItem]:
	try:
		archive, member_name = read_zip_member(zip_path, ("kanjidic", "kanjidict2"), ".xml")
		return parse_kanjidict_xml(archive, member_name)
	except RuntimeError:
		return parse_kanjidict_yomitan(zip_path)


def parse_kanjidict_xml(archive: zipfile.ZipFile, member_name: str) -> list[KanjidictImportItem]:
	try:
		with archive.open(member_name) as handle:
			items: list[KanjidictImportItem] = []
			for event, elem in ET.iterparse(handle, events=("end",)):
				if event != "end" or elem.tag != "character":
					continue
				literal = (elem.findtext("literal") or "").strip()
				if not literal:
					elem.clear()
					continue
				on_readings: list[str] = []
				kun_readings: list[str] = []
				meanings: list[str] = []
				for reading in elem.findall("reading_meaning/rmgroup/reading"):
					value = (reading.text or "").strip()
					r_type = (reading.attrib.get("r_type") or "").strip()
					if not value:
						continue
					if r_type == "ja_on":
						on_readings.append(value)
					elif r_type == "ja_kun":
						kun_readings.append(value)
				for meaning in elem.findall("reading_meaning/rmgroup/meaning"):
					lang = (meaning.attrib.get("m_lang") or "").strip().lower()
					if lang and lang != "en":
						continue
					value = (meaning.text or "").strip()
					if value:
						meanings.append(value)
				nanori = unique((node.text or "").strip() for node in elem.findall("reading_meaning/nanori"))
				item = KanjidictImportItem(
					item_id=f"kanji:{literal}",
					literal=literal,
					grade=parse_int(elem.findtext("misc/grade")),
					jlpt=parse_int(elem.findtext("misc/jlpt")),
					stroke_count=parse_int(elem.findtext("misc/stroke_count")),
					frequency=parse_int(elem.findtext("misc/freq")),
					on_readings=unique(on_readings),
					kun_readings=unique(kun_readings),
					nanori=nanori,
					meanings=unique(meanings)
				)
				items.append(item)
				elem.clear()
			return items
	finally:
		archive.close()


def parse_kanjidict_yomitan(zip_path: Path) -> list[KanjidictImportItem]:
	print(f"Parsing KANJIDICT from Yomitan format: {zip_path}", file=sys.stderr)
	items: list[KanjidictImportItem] = []
	with zipfile.ZipFile(zip_path, "r") as archive:
		for name in archive.namelist():
			if not (name.startswith("kanji_bank_") and name.endswith(".json")):
				continue
			
			with archive.open(name) as handle:
				data = json.load(handle)
				for entry in data:
					if len(entry) < 6:
						continue
					
					literal = entry[0]
					on_readings = entry[1].split() if entry[1] else []
					kun_readings = entry[2].split() if entry[2] else []
					meanings = entry[4]
					stats = entry[5] if isinstance(entry[5], dict) else {}
					
					item = KanjidictImportItem(
						item_id=f"kanji:{literal}",
						literal=literal,
						grade=parse_int(stats.get("grade")),
						jlpt=parse_int(stats.get("jlpt")),
						stroke_count=parse_int(stats.get("strokes")),
						frequency=parse_int(stats.get("freq")),
						on_readings=unique(on_readings),
						kun_readings=unique(kun_readings),
						nanori=[],
						meanings=unique(meanings)
					)
					items.append(item)
	return items


def join_list(values: list[str]) -> str:
	return "; ".join(value for value in values if value)


def build_jmdict_sql(item: JMDictImportItem) -> str:
	sql = []
	sql.append(
		"INSERT OR REPLACE INTO jmdict_entry (ent_seq, primary_kanji, primary_reading, gloss, parts_of_speech) VALUES ({ent_seq}, '{kanji}', '{reading}', '{gloss}', '{pos}');".format(
			ent_seq=item.ent_seq,
			kanji=escape_sql(item.primary_kanji),
			reading=escape_sql(item.primary_reading),
			gloss=escape_sql(item.gloss),
			pos=escape_sql(join_list(item.parts_of_speech))
		)
	)
	sql.append(f"DELETE FROM jmdict_term WHERE ent_seq = {item.ent_seq};")
	
	term_rows = []
	for index, term in enumerate(item.terms_kanji):
		term_rows.append(f"('{escape_sql(term)}', {item.ent_seq}, 'kanji', {1 if index == 0 else 0})")
	for index, term in enumerate(item.terms_reading):
		term_rows.append(f"('{escape_sql(term)}', {item.ent_seq}, 'reading', {1 if index == 0 else 0})")
	
	if term_rows:
		sql.append(f"INSERT OR REPLACE INTO jmdict_term (term, ent_seq, term_kind, is_primary) VALUES {', '.join(term_rows)};")
	
	return "\n".join(sql)


def build_kanjidict_sql(item: KanjidictImportItem) -> str:
	return "INSERT OR REPLACE INTO kanjidict_entry (literal, grade, jlpt, stroke_count, frequency, on_readings, kun_readings, nanori, meanings) VALUES ('{literal}', {grade}, {jlpt}, {stroke}, {freq}, '{on}', '{kun}', '{nanori}', '{meanings}');".format(
		literal=escape_sql(item.literal),
		grade="NULL" if item.grade is None else item.grade,
		jlpt="NULL" if item.jlpt is None else item.jlpt,
		stroke="NULL" if item.stroke_count is None else item.stroke_count,
		freq="NULL" if item.frequency is None else item.frequency,
		on=escape_sql(join_list(item.on_readings)),
		kun=escape_sql(join_list(item.kun_readings)),
		nanori=escape_sql(join_list(item.nanori)),
		meanings=escape_sql(join_list(item.meanings))
	)


def load_schema_sql() -> str:
	schema_path = Path(__file__).resolve().parent.parent / "migrations" / "dictionary" / "0001_dictionary.sql"
	return schema_path.read_text(encoding="utf-8")


def chunked(values: list[Any], size: int) -> Iterable[list[Any]]:
	for i in range(0, len(values), size):
		yield values[i:i + size]


def main() -> int:
	args = parse_args()
	validate_args(args)
	
	all_items: list[ImportItem] = []
	if args.scope in {"all", "jmdict"}:
		print("Parsing JMdict...", file=sys.stderr)
		all_items.extend(parse_jmdict_items(args.jmdict_zip))
	
	if args.scope in {"all", "kanjidict"}:
		print("Parsing KANJIDICT...", file=sys.stderr)
		all_items.extend(parse_kanjidict_items(args.kanjidict_zip))
	
	if not all_items:
		print("No items found to import.", file=sys.stderr)
		return 0

	print(f"Splitting {len(all_items)} entries into chunks of {args.entries_per_chunk}...", file=sys.stderr)
	
	d1_config = D1Config(
		account_id=args.account_id,
		database_id=args.database_id,
		api_token=args.api_token if args.api_token else None,
		use_local=args.local
	)

	for i, chunk in enumerate(chunked(all_items, args.entries_per_chunk), 1):
		chunk_file = Path(f"data/dictionary_chunk_{i}.sql")
		chunk_file.parent.mkdir(parents=True, exist_ok=True)
		
		print(f"Generating chunk {i}: {chunk_file}", file=sys.stderr)
		with chunk_file.open("w", encoding="utf-8") as f:
			f.write("PRAGMA foreign_keys = OFF;\n")
			if i == 1:
				f.write(load_schema_sql() + "\n")
			
			for item in chunk:
				if isinstance(item, JMDictImportItem):
					f.write(build_jmdict_sql(item) + "\n")
				else:
					f.write(build_kanjidict_sql(item) + "\n")
			
			f.write("PRAGMA foreign_keys = ON;\n")

		print(f"Executing chunk {i} via Wrangler...", file=sys.stderr)
		try:
			execute_sql_file(d1_config, chunk_file)
			print(f"Chunk {i} completed successfully.", file=sys.stderr)
		except Exception as e:
			print(f"Error in chunk {i}: {e}", file=sys.stderr)
			return 1

	print("Full dictionary import completed successfully!", file=sys.stderr)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
