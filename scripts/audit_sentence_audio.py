from __future__ import annotations

import argparse
import json
import subprocess
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from sentences_common import DEFAULT_PUBLIC_AUDIO_BASE_URL, default_sentence_input_path, iter_normalized_sentences, validate_sentence_input_path


@dataclass(frozen=True)
class RemoteSentenceRow:
	sentence: str
	translation: str
	source: str
	audio_path: str
	audio_url: str
	word: str
	word_definition: str


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(description="Compare production sentence/audio mappings against the Anki deck.")
	parser.add_argument("--input", type=Path, default=default_sentence_input_path())
	parser.add_argument("--db-name", default="jitori")
	parser.add_argument("--remote", action="store_true", help="Query the remote D1 database instead of local.")
	parser.add_argument("--page-size", type=int, default=1000)
	parser.add_argument("--public-audio-base-url", default=DEFAULT_PUBLIC_AUDIO_BASE_URL)
	return parser.parse_args()


def load_expected_rows(input_path: Path, public_audio_base_url: str) -> list[dict]:
	return list(iter_normalized_sentences(validate_sentence_input_path(input_path), public_audio_base_url))


def fetch_remote_page(db_name: str, remote: bool, page_size: int, offset: int) -> list[RemoteSentenceRow]:
	command = f"""
SELECT
	sentence,
	translation,
	source,
	audio_path,
	audio_url,
	word,
	word_definition
FROM sentence
ORDER BY sentence, translation
LIMIT {int(page_size)} OFFSET {int(offset)};
""".strip()
	args = ["npx", "wrangler", "d1", "execute", db_name, "--json", "--command", command]
	args.append("--remote" if remote else "--local")
	process = subprocess.run(args, check=True, capture_output=True, text=True)
	payload = json.loads(process.stdout)
	results = payload[0]["results"] if payload else []
	return [
		RemoteSentenceRow(
			sentence=row.get("sentence", ""),
			translation=row.get("translation", ""),
			source=row.get("source", ""),
			audio_path=row.get("audio_path", ""),
			audio_url=row.get("audio_url", ""),
			word=row.get("word", ""),
			word_definition=row.get("word_definition", "")
		)
		for row in results
	]


def fetch_all_remote_rows(db_name: str, remote: bool, page_size: int) -> list[RemoteSentenceRow]:
	rows: list[RemoteSentenceRow] = []
	offset = 0
	while True:
		page = fetch_remote_page(db_name, remote, page_size, offset)
		if not page:
			return rows
		rows.extend(page)
		offset += len(page)


def key_for_record(record: dict | RemoteSentenceRow) -> tuple[str, str]:
	return (record["sentence"], record["translation"]) if isinstance(record, dict) else (record.sentence, record.translation)


def summarize_differences(expected_rows: list[dict], remote_rows: list[RemoteSentenceRow]) -> None:
	expected_by_key = {key_for_record(row): row for row in expected_rows}
	remote_by_key = {key_for_record(row): row for row in remote_rows}

	missing_keys = sorted(set(expected_by_key) - set(remote_by_key))
	extra_keys = sorted(set(remote_by_key) - set(expected_by_key))
	mismatch_keys = []
	for key in sorted(set(expected_by_key) & set(remote_by_key)):
		expected = expected_by_key[key]
		remote = remote_by_key[key]
		if (
			expected["audio_path"] != remote.audio_path
			or expected["audio_url"] != remote.audio_url
			or expected["source"] != remote.source
			or expected["word"] != remote.word
			or expected["word_definition"] != remote.word_definition
		):
			mismatch_keys.append(key)

	expected_audio_dups = Counter(row["audio_path"] for row in expected_rows if row["audio_path"])
	remote_audio_dups = Counter(row.audio_path for row in remote_rows if row.audio_path)

	print(f"expected_rows={len(expected_rows)}")
	print(f"remote_rows={len(remote_rows)}")
	print(f"missing_rows={len(missing_keys)}")
	print(f"extra_rows={len(extra_keys)}")
	print(f"mismatched_rows={len(mismatch_keys)}")
	print(f"expected_duplicate_audio_paths={sum(1 for count in expected_audio_dups.values() if count > 1)}")
	print(f"remote_duplicate_audio_paths={sum(1 for count in remote_audio_dups.values() if count > 1)}")

	if missing_keys:
		print("\nMissing rows from remote:")
		for key in missing_keys[:20]:
			expected = expected_by_key[key]
			print(json.dumps({
				"sentence": expected["sentence"],
				"translation": expected["translation"],
				"audio_path": expected["audio_path"],
				"source": expected["source"]
			}, ensure_ascii=False))

	if mismatch_keys:
		print("\nMismatched rows:")
		for key in mismatch_keys[:20]:
			expected = expected_by_key[key]
			remote = remote_by_key[key]
			print(json.dumps({
				"sentence": expected["sentence"],
				"translation": expected["translation"],
				"expected_audio_path": expected["audio_path"],
				"remote_audio_path": remote.audio_path,
				"expected_source": expected["source"],
				"remote_source": remote.source,
				"expected_word": expected["word"],
				"remote_word": remote.word
			}, ensure_ascii=False))

	if extra_keys:
		print("\nExtra rows in remote:")
		for key in extra_keys[:20]:
			remote = remote_by_key[key]
			print(json.dumps({
				"sentence": remote.sentence,
				"translation": remote.translation,
				"audio_path": remote.audio_path,
				"source": remote.source
			}, ensure_ascii=False))


def main() -> int:
	args = parse_args()
	expected_rows = load_expected_rows(args.input, args.public_audio_base_url)
	remote_rows = fetch_all_remote_rows(args.db_name, args.remote, args.page_size)
	summarize_differences(expected_rows, remote_rows)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
