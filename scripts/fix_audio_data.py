from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from sentences_common import DEFAULT_PUBLIC_AUDIO_BASE_URL, DEFAULT_ANKI_DECK_PATH, iter_normalized_sentences, validate_sentence_input_path

REBUILD_TABLE_SQL = """
CREATE TABLE sentence_rebuild (
	id TEXT PRIMARY KEY,
	source TEXT NOT NULL,
	audio_path TEXT NOT NULL,
	audio_url TEXT NOT NULL,
	sentence TEXT NOT NULL,
	translation TEXT NOT NULL,
	word TEXT NOT NULL DEFAULT '',
	word_definition TEXT NOT NULL DEFAULT '',
	sentence_length INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sentence_rebuild_audio_path ON sentence_rebuild(audio_path);
CREATE INDEX idx_sentence_rebuild_source ON sentence_rebuild(source);
CREATE INDEX idx_sentence_rebuild_length ON sentence_rebuild(sentence_length);
"""


def escape_sql(value: str) -> str:
	return value.replace("'", "''")


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Rebuild the sentence table from the Anki deck without touching R2 audio objects."
	)
	parser.add_argument("--input", type=Path, default=DEFAULT_ANKI_DECK_PATH)
	parser.add_argument("--remote", action="store_true", help="Run against remote D1 database")
	parser.add_argument("--db-name", default="jitori")
	parser.add_argument("--output-sql", type=Path, default=Path("data/fix_audio.sql"))
	parser.add_argument("--public-audio-base-url", default=DEFAULT_PUBLIC_AUDIO_BASE_URL)
	return parser.parse_args()


def build_insert_sql(record: dict) -> str:
	return """
INSERT INTO sentence_rebuild (
	id,
	source,
	audio_path,
	audio_url,
	sentence,
	translation,
	word,
	word_definition,
	sentence_length
) VALUES (
	'{id}',
	'{source}',
	'{audio_path}',
	'{audio_url}',
	'{sentence}',
	'{translation}',
	'{word}',
	'{word_definition}',
	{sentence_length}
);
""".format(
		id=escape_sql(record["id"]),
		source=escape_sql(record["source"]),
		audio_path=escape_sql(record["audio_path"]),
		audio_url=escape_sql(record["audio_url"]),
		sentence=escape_sql(record["sentence"]),
		translation=escape_sql(record["translation"]),
		word=escape_sql(record["word"]),
		word_definition=escape_sql(record["word_definition"]),
		sentence_length=len(record["sentence"])
	)


def write_rebuild_sql(output_path: Path, records: list[dict]) -> None:
	output_path.parent.mkdir(parents=True, exist_ok=True)
	with output_path.open("w", encoding="utf-8") as handle:
		handle.write("PRAGMA foreign_keys = OFF;\n")
		handle.write("DROP TABLE IF EXISTS sentence_rebuild;\n")
		handle.write(REBUILD_TABLE_SQL + "\n")
		for record in records:
			handle.write(build_insert_sql(record) + "\n")
		handle.write("DROP TABLE sentence;\n")
		handle.write("ALTER TABLE sentence_rebuild RENAME TO sentence;\n")
		handle.write("CREATE INDEX IF NOT EXISTS idx_sentence_audio_path ON sentence(audio_path);\n")
		handle.write("CREATE INDEX IF NOT EXISTS idx_sentence_source ON sentence(source);\n")
		handle.write("CREATE INDEX IF NOT EXISTS idx_sentence_length ON sentence(sentence_length);\n")
		handle.write("PRAGMA foreign_keys = ON;\n")


def execute_sql_file(db_name: str, sql_path: Path, remote: bool) -> None:
	cmd = ["npx", "wrangler", "d1", "execute", db_name, f"--file={sql_path}", "--yes"]
	cmd.append("--remote" if remote else "--local")
	subprocess.run(cmd, check=True)


def main() -> int:
	args = parse_args()
	deck_path = validate_sentence_input_path(args.input)
	records = list(iter_normalized_sentences(deck_path, args.public_audio_base_url))
	write_rebuild_sql(args.output_sql, records)
	print(f"Generated rebuild SQL for {len(records)} sentences at {args.output_sql}")
	execute_sql_file(args.db_name, args.output_sql, args.remote)
	print("Sentence table rebuilt successfully.")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
