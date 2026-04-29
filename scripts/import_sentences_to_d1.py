from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

try:
	import tomllib
except ImportError:
	try:
		import tomli as tomllib
	except ImportError:
		tomllib = None

from d1_client import D1Config, execute_sql_file
from sentences_common import DEFAULT_PUBLIC_AUDIO_BASE_URL, default_sentence_input_path, iter_normalized_sentences, validate_sentence_input_path

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS sentence (
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
CREATE INDEX IF NOT EXISTS idx_sentence_audio_path ON sentence(audio_path);
CREATE INDEX IF NOT EXISTS idx_sentence_source ON sentence(source);
CREATE INDEX IF NOT EXISTS idx_sentence_length ON sentence(sentence_length);
"""


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
	parser = argparse.ArgumentParser(description="Import sentence records into Cloudflare D1.")
	parser.add_argument("--input", type=Path, default=default_sentence_input_path())
	parser.add_argument("--account-id", default=os.environ.get("CLOUDFLARE_ACCOUNT_ID", ""))
	parser.add_argument("--database-id", default=os.environ.get("CLOUDFLARE_D1_DATABASE_ID", wrangler_config.get("database_id", "")))
	parser.add_argument("--api-token", default=os.environ.get("CLOUDFLARE_API_TOKEN", ""))
	parser.add_argument("--public-audio-base-url", default=os.environ.get("PUBLIC_AUDIO_BASE_URL", DEFAULT_PUBLIC_AUDIO_BASE_URL))
	parser.add_argument("--local", action="store_true", help="Run against local D1 database")
	parser.add_argument("--output-sql", type=Path, default=Path("data/sentences_import.sql"))
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


def escape_sql(value: str) -> str:
	return value.replace("'", "''")


def build_insert_sql(record: dict) -> str:
	return """
INSERT OR REPLACE INTO sentence (
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


def main() -> int:
	args = parse_args()
	validate_args(args)
	args.input = validate_sentence_input_path(args.input)
	
	args.output_sql.parent.mkdir(parents=True, exist_ok=True)
	
	print(f"Generating SQL file: {args.output_sql}", file=sys.stderr)
	records = iter_normalized_sentences(args.input, args.public_audio_base_url)
	
	count = 0
	with args.output_sql.open("w", encoding="utf-8") as f:
		f.write("PRAGMA foreign_keys = OFF;\n")
		f.write(CREATE_TABLE_SQL + "\n")
		for record in records:
			f.write(build_insert_sql(record) + "\n")
			count += 1
		f.write("PRAGMA foreign_keys = ON;\n")
	
	print(f"SQL file generated successfully with {count} sentences ({os.path.getsize(args.output_sql) / 1024 / 1024:.2f} MB).", file=sys.stderr)

	d1_config = D1Config(
		account_id=args.account_id,
		database_id=args.database_id,
		api_token=args.api_token if args.api_token else None,
		use_local=args.local
	)

	print(f"Executing import via Wrangler ({'local' if args.local else 'remote'})...", file=sys.stderr)
	execute_sql_file(d1_config, args.output_sql)
	
	print("Import completed successfully!", file=sys.stderr)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
