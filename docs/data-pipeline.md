# Data Pipeline & Production Import

This guide explains how to acquire the source data and import it into a production Cloudflare D1 database.

## 1. Source Data Acquisition

To populate the full database, you need to download the following archives and place them in the **root** of the project:

### A. Ankidrone Sentence Pack
- **Source**: [Tatsumoto's Ankidrone Sentence Pack](https://tatsumoto-ren.github.io/blog/ankidrone-sentence-pack.html)
- **File**: `Ankidrone Sentence Pack V4.apkg`
- **Description**: Contains 58k+ sentences with high-quality audio.

### B. JMdict (Dictionary Entries)
- **Source**: [JMdict (Electronic Dictionary Research and Development Group)](http://www.edrdg.org/jmdict/j_jmdict.html)
- **File**: `JMdict_english.zip` (Yomitan format recommended)
- **Description**: The primary source for Japanese-English definitions.

### C. KANJIDICT (Kanji Data)
- **Source**: [KANJIDICT2](http://www.edrdg.org/kanjidic/kanjidic2.html)
- **File**: `KANJIDIC_english.zip` (Yomitan format recommended)
- **Description**: Detailed information for 10k+ kanji characters.

### D. Japanese Wiktionary (Japanese Definitions)
- **Source**: [Kaikki Japanese Wiktionary export](https://kaikki.org/dictionary/Japanese/)
- **File**: a Japanese JSONL or JSONL.GZ export
- **License**: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

---

## 2. Full Production Pipeline

### Step A: Audio Processing (R2)
Extract the audio from the Anki deck and upload it to Cloudflare R2 so it can be served publicly.

```bash
# 1. Extract audio to data/audio/
python3 scripts/download_sentence_audio.py --workers 8

# 2. Upload to your R2 bucket (configured in wrangler.toml)
python3 scripts/upload_sentence_audio_to_r2.py
```

### Step B: Database Schema (D1)
Initialize the production database schema.

```bash
npx wrangler d1 migrations apply jitori --remote
```

### Step C: Bulk Data Import
Generate high-performance SQL files and execute them on Cloudflare.

```bash
# 1. Generate SQL and Import Sentences
python3 scripts/import_sentences_to_d1.py

# 2. Generate SQL and Import Dictionary
python3 scripts/import_dictionaries_to_d1.py

# 3. Generate Japanese Wiktionary SQL chunks without importing them
python3 scripts/import_wiktionary_to_d1.py data/wiktionary/kaikki.org-dictionary-Japanese.jsonl.gz data/wiktionary_sql --chunk-size 10000

# 4. Validate one chunk against the local D1 database, then import every chunk remotely
npx wrangler d1 execute jitori --local --file=data/wiktionary_sql/wiktionary_0001.sql
for file in data/wiktionary_sql/*.sql; do
  npx wrangler d1 execute jitori --remote --file="$file"
done
```

Raw Wiktionary exports and generated SQL chunks are intentionally untracked. The importer only generates deterministic SQL; it never calls Wrangler or modifies a database.

---

## 3. Troubleshooting

### Manual Execution
If the Python script encounters a timeout while calling Wrangler for the 170MB+ dictionary file, you can run the final import command manually in your terminal:

```bash
npx wrangler d1 execute jitori --remote --file=data/dictionary_full.sql
```

### Large File Support
D1 supports up to 5GB SQL files. Ensure your SQL files are generated using `INSERT OR REPLACE` to allow for safe retries without duplication errors.
