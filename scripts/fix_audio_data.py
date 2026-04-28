import argparse
import sys
import os
from pathlib import Path

# Add scripts directory to path to import other script logic
sys.path.append(str(Path(__file__).parent))

from sentences_common import iter_normalized_sentences, DEFAULT_PUBLIC_AUDIO_BASE_URL, DEFAULT_ANKI_DECK_PATH

def escape_sql(value: str) -> str:
    return value.replace("'", "''")

def main():
    parser = argparse.ArgumentParser(description="Fix audio metadata in D1 by re-parsing the Anki deck.")
    parser.add_argument("--input", type=Path, default=DEFAULT_ANKI_DECK_PATH)
    parser.add_argument("--remote", action="store_true", help="Run against remote D1 database")
    parser.add_argument("--output-sql", type=Path, default=Path("data/fix_audio.sql"))
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Error: Anki deck not found at {args.input}")
        return 1

    print(f"Parsing Anki deck: {args.input}")
    records = iter_normalized_sentences(args.input, DEFAULT_PUBLIC_AUDIO_BASE_URL)

    count = 0
    print(f"Generating SQL: {args.output_sql}")
    with args.output_sql.open("w", encoding="utf-8") as f:
        f.write("PRAGMA foreign_keys = OFF;\n")
        for record in records:
            f.write(f"UPDATE sentence SET audio_path = '{escape_sql(record['audio_path'])}', audio_url = '{escape_sql(record['audio_url'])}' WHERE sentence = '{escape_sql(record['sentence'])}' AND translation = '{escape_sql(record['translation'])}';\n")
            count += 1
        f.write("PRAGMA foreign_keys = ON;\n")

    print(f"Generated {count} update statements.")
    
    db_flag = "--remote" if args.remote else "--local"
    print(f"Executing against D1 ({db_flag})...")
    import subprocess
    cmd = ["npx", "wrangler", "d1", "execute", "jitori", db_flag, f"--file={args.output_sql}", "--yes"]
    
    try:
        subprocess.run(cmd, check=True)
        print("✅ Audio metadata fixed in D1!")
    except Exception as e:
        print(f"❌ Error executing SQL: {e}")

if __name__ == "__main__":
    main()
