import argparse
import sys
import os
import subprocess
from pathlib import Path

# Add scripts directory to path to import other script logic
sys.path.append(str(Path(__file__).parent))

from d1_client import D1Config, execute_sql_file
from import_sentences_to_d1 import build_insert_sql
from import_dictionaries_to_d1 import (
    build_jmdict_sql, 
    build_kanjidict_sql, 
    JMDictImportItem,
    KanjidictImportItem
)

def main():
    parser = argparse.ArgumentParser(description="Seed local development database with a small subset of dummy data.")
    parser.add_argument("--output-sql", type=Path, default=Path("data/seed_dev.sql"))
    parser.add_argument("--audio-dir", type=Path, default=Path("static/audio"))
    args = parser.parse_args()

    # Ensure directories exist
    args.output_sql.parent.mkdir(parents=True, exist_ok=True)
    args.audio_dir.mkdir(parents=True, exist_ok=True)

    print("--- Seeding Development Database with Dummy Data ---")

    # 1. Generate Dummy Sentences
    seed_sentences = [
        {
            "id": "dummy_sentence_1",
            "source": "DummySource",
            "audio_path": "dummy1.mp3",
            "audio_url": "/audio/dummy1.mp3",
            "sentence": "これはテストです。",
            "translation": "This is a test.",
            "word": "テスト",
            "word_definition": "test",
            "sentence_length": 9
        },
        {
            "id": "dummy_sentence_2",
            "source": "DummySource",
            "audio_path": "dummy2.mp3",
            "audio_url": "/audio/dummy2.mp3",
            "sentence": "私はりんごを食べる。",
            "translation": "I eat an apple.",
            "word": "食べる",
            "word_definition": "to eat",
            "sentence_length": 10
        }
    ]

    # Create dummy audio files
    for s in seed_sentences:
        dummy_audio = args.audio_dir / s["audio_path"]
        with open(dummy_audio, "wb") as f:
            f.write(b"dummy audio content")

    # 2. Generate Dummy JMdict
    jm_items = [
        JMDictImportItem(
            item_id="1000000",
            ent_seq=1000000,
            primary_kanji="食べる",
            primary_reading="たべる",
            gloss="to eat; to live on (e.g. a salary)",
            parts_of_speech=["verb (ichidan)"],
            terms_kanji=["食べる"],
            terms_reading=["たべる"]
        ),
        JMDictImportItem(
            item_id="1000001",
            ent_seq=1000001,
            primary_kanji="テスト",
            primary_reading="テスト",
            gloss="test; examination",
            parts_of_speech=["noun", "suru verb"],
            terms_kanji=["テスト"],
            terms_reading=["テスト"]
        )
    ]

    # 3. Generate Dummy KANJIDICT
    kj_items = [
        KanjidictImportItem(
            item_id="食",
            literal="食",
            grade=2,
            jlpt=4,
            stroke_count=9,
            frequency=242,
            on_readings=["ショク", "ジキ"],
            kun_readings=["く.う", "く.らう", "た.べる", "は.む"],
            nanori=["あき"],
            meanings=["eat", "food"]
        )
    ]

    # 4. Generate SQL
    print(f"Generating SQL: {args.output_sql}")
    with args.output_sql.open("w", encoding="utf-8") as f:
        f.write("PRAGMA foreign_keys = OFF;\n")
        
        # Data
        for s in seed_sentences:
            f.write(f"INSERT OR REPLACE INTO sentence (id, source, audio_path, audio_url, sentence, translation, word, word_definition, sentence_length) VALUES ('{s['id']}', '{s['source']}', '{s['audio_path']}', '{s['audio_url']}', '{s['sentence']}', '{s['translation']}', '{s['word']}', '{s['word_definition']}', {s['sentence_length']});\n")
        
        for item in jm_items:
            f.write(build_jmdict_sql(item) + "\n")
            
        for item in kj_items:
            f.write(build_kanjidict_sql(item) + "\n")
            
        f.write("PRAGMA foreign_keys = ON;\n")

    # 5. Execute against local D1
    print("Executing SQL against local D1...")
    from import_sentences_to_d1 import load_wrangler_config
    config_data = load_wrangler_config()
    
    db_id = "jitori"
    
    # Run wrangler command directly to avoid python json parsing overhead for dev seed
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
