from __future__ import annotations

import argparse
import sys
import os
from pathlib import Path

# Add scripts directory to path to import other script logic
sys.path.append(str(Path(__file__).parent))

from d1_client import D1Config, execute_sql_file
from import_sentences_to_d1 import build_insert_sql, CREATE_TABLE_SQL
from import_dictionaries_to_d1 import (
    parse_jmdict_items, 
    parse_kanjidict_items, 
    build_jmdict_sql, 
    build_kanjidict_sql, 
    load_schema_sql
)
from sentences_common import (
    iter_normalized_sentences, 
    default_sentence_input_path, 
    AnkiDeckArchive
)

def main():
    parser = argparse.ArgumentParser(description="Seed local development database with a small subset of data.")
    parser.add_argument("--sentences", type=int, default=100, help="Number of sentences to seed")
    parser.add_argument("--jmdict", type=int, default=500, help="Number of dictionary entries to seed")
    parser.add_argument("--kanji", type=int, default=50, help="Number of kanji to seed")
    parser.add_argument("--output-sql", type=Path, default=Path("data/seed_dev.sql"))
    parser.add_argument("--audio-dir", type=Path, default=Path("static/audio"))
    args = parser.parse_args()

    # Ensure directories exist
    args.output_sql.parent.mkdir(parents=True, exist_ok=True)
    args.audio_dir.mkdir(parents=True, exist_ok=True)

    print(f"--- Seeding Development Database ({args.sentences} sentences, {args.jmdict} entries, {args.kanji} kanji) ---")

    # 1. Collect Sentences
    print("Reading sentences...")
    input_path = default_sentence_input_path()
    # For dev, we point audio_url to local static path
    all_sentences = list(iter_normalized_sentences(input_path, "/audio"))
    seed_sentences = all_sentences[:args.sentences]

    # 2. Extract Audio for those sentences
    print(f"Extracting {len(seed_sentences)} audio files to {args.audio_dir}...")
    with AnkiDeckArchive(input_path) as deck:
        for s in seed_sentences:
            if s["audio_path"]:
                dest = args.audio_dir / s["audio_path"]
                try:
                    deck.extract_media_file(s["audio_path"], dest)
                except Exception as e:
                    pass # Skip missing audio

    # 3. Collect Dictionary & Kanji
    print("Reading JMdict...")
    jm_items = parse_jmdict_items(Path("JMdict_english.zip"))[:args.jmdict]
    
    print("Reading KANJIDICT...")
    kj_items = parse_kanjidict_items(Path("KANJIDIC_english.zip"))[:args.kanji]

    # 4. Generate SQL
    print(f"Generating SQL: {args.output_sql}")
    with args.output_sql.open("w", encoding="utf-8") as f:
        f.write("PRAGMA foreign_keys = OFF;\n")
        
        # Schema
        f.write("-- Sentences Table\n")
        f.write(CREATE_TABLE_SQL + "\n")
        f.write("-- Dictionary Tables\n")
        f.write(load_schema_sql() + "\n")

        # Data
        for s in seed_sentences:
            f.write(build_insert_sql(s) + "\n")
        
        for item in jm_items:
            f.write(build_jmdict_sql(item) + "\n")
            
        for item in kj_items:
            f.write(build_kanjidict_sql(item) + "\n")
            
        f.write("PRAGMA foreign_keys = ON;\n")

    # 5. Execute against local D1
    print("Executing SQL against local D1...")
    from import_sentences_to_d1 import load_wrangler_config
    config_data = load_wrangler_config()
    
    db_id = config_data.get("database_id", "jitori")
    
    # Run wrangler command directly to avoid python json parsing overhead for dev seed
    import subprocess
    cmd = ["npx", "wrangler", "d1", "execute", db_id, "--local", f"--file={args.output_sql}", "--yes"]
    
    try:
        subprocess.run(cmd, check=True)
        print("\n✅ Success! Local development environment seeded.")
        print(f"Sentences audio available in: {args.audio_dir}")
        print("\nYou can now run 'npm run dev' and see your data.")
    except Exception as e:
        print(f"\n❌ Error seeding database: {e}")

if __name__ == "__main__":
    main()
