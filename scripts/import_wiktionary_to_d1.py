from __future__ import annotations

import argparse
import gzip
import json
from collections.abc import Iterable, Iterator
from pathlib import Path
from urllib.parse import quote


def unique(values: Iterable[str]) -> list[str]:
	seen: set[str] = set()
	result: list[str] = []
	for value in values:
		normalized = value.strip()
		if normalized and normalized not in seen:
			seen.add(normalized)
			result.append(normalized)
	return result


def japanese_text(value: object) -> str:
	if isinstance(value, str):
		return value.strip()
	if isinstance(value, list):
		return ' '.join(filter(None, (japanese_text(item) for item in value))).strip()
	return ''


def reading_candidates(entry: dict[str, object]) -> list[str]:
	forms = entry.get('forms', [])
	if not isinstance(forms, list):
		return []
	values = [
		form.get('form', '')
		for form in forms
		if isinstance(form, dict) and isinstance(form.get('form'), str)
	]
	return unique(value for value in values if any('\u3040' <= char <= '\u30ff' for char in value))


def sense_definitions(entry: dict[str, object]) -> list[str]:
	senses = entry.get('senses', [])
	if not isinstance(senses, list):
		return []
	definitions: list[str] = []
	for sense in senses:
		if not isinstance(sense, dict):
			continue
		glosses = sense.get('glosses', sense.get('raw_glosses', []))
		if isinstance(glosses, list):
			definitions.extend(japanese_text(gloss) for gloss in glosses)
		elif isinstance(glosses, str):
			definitions.append(japanese_text(glosses))
	return unique(definitions)


def entry_terms(entry: dict[str, object], headword: str, readings: list[str]) -> list[tuple[str, str]]:
	terms = [(headword, 'headword')]
	terms.extend((reading, 'reading') for reading in readings)
	forms = entry.get('forms', [])
	if isinstance(forms, list):
		terms.extend(
			(form['form'], 'form')
			for form in forms
			if isinstance(form, dict) and isinstance(form.get('form'), str) and form['form'].strip()
		)
	seen: set[tuple[str, str]] = set()
	return [term for term in terms if not (term in seen or seen.add(term))]


def escape_sql(value: str) -> str:
	return value.replace("'", "''")


def sql_value(value: str | int) -> str:
	return str(value) if isinstance(value, int) else f"'{escape_sql(value)}'"


def entry_sql(entry_id: int, headword: str, reading: str, definition: str, part_of_speech: str) -> str:
	url = f'https://ja.wiktionary.org/wiki/{quote(headword)}'
	values = [entry_id, headword, reading, definition, part_of_speech, url]
	return 'INSERT OR REPLACE INTO wiktionary_entry (id, primary_kanji, primary_reading, definition, parts_of_speech, source_url) VALUES (' + ', '.join(sql_value(value) for value in values) + ');'


def term_sql(entry_id: int, term: str, term_kind: str) -> str:
	values = [term, entry_id, term_kind]
	return 'INSERT OR REPLACE INTO wiktionary_term (term, entry_id, term_kind) VALUES (' + ', '.join(sql_value(value) for value in values) + ');'


def source_lines(path: Path) -> Iterator[str]:
	open_file = gzip.open if path.suffix == '.gz' else open
	with open_file(path, 'rt', encoding='utf-8') as source:
		for line in source:
			yield line


def generate_sql(source_path: Path, output_dir: Path, chunk_size: int) -> int:
	output_dir.mkdir(parents=True, exist_ok=True)
	chunk: list[str] = []
	chunk_number = 1
	entry_id = 0

	def flush() -> None:
		nonlocal chunk_number, chunk
		if not chunk:
			return
		(output_dir / f'wiktionary_{chunk_number:04d}.sql').write_text('\n'.join(chunk) + '\n', encoding='utf-8')
		chunk_number += 1
		chunk = []

	for line in source_lines(source_path):
		try:
			entry = json.loads(line)
		except json.JSONDecodeError:
			continue
		if not isinstance(entry, dict) or entry.get('lang_code') != 'ja':
			continue
		headword = japanese_text(entry.get('word'))
		definitions = sense_definitions(entry)
		if not headword or not definitions:
			continue
		entry_id += 1
		readings = reading_candidates(entry)
		reading = readings[0] if readings else headword
		part_of_speech = japanese_text(entry.get('pos')) or 'unknown'
		chunk.append(entry_sql(entry_id, headword, reading, '; '.join(definitions), part_of_speech))
		chunk.extend(term_sql(entry_id, term, term_kind) for term, term_kind in entry_terms(entry, headword, readings))
		if entry_id % chunk_size == 0:
			flush()
	flush()
	return entry_id


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(description='Generate D1 SQL from a Kaikki Japanese Wiktionary JSONL export.')
	parser.add_argument('source', type=Path)
	parser.add_argument('output_dir', type=Path)
	parser.add_argument('--chunk-size', type=int, default=10000)
	return parser.parse_args()


def main() -> None:
	args = parse_args()
	if args.chunk_size < 1:
		raise SystemExit('--chunk-size must be at least 1.')
	if not args.source.is_file():
		raise SystemExit(f'Source file not found: {args.source}')
	count = generate_sql(args.source, args.output_dir, args.chunk_size)
	print(f'Generated SQL for {count} Wiktionary entries in {args.output_dir}.')


if __name__ == '__main__':
	main()
