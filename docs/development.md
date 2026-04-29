# Development Setup Guide

Follow these steps to get a local instance of Jitori running on your machine.

## Prerequisites
- **Node.js**: 18.x or higher
- **Python**: 3.12.x or higher
- **Wrangler**: Installed via npm (`npm install`)

## Quick Start (The "One Command" Setup)
Jitori includes a seeding script that prepares a fully functional local environment with real data and audio.

1. **Clone and Install**:
   ```bash
   git clone <repo-url>
   cd jitori
   npm install
   ```

2. **Seed the Environment**:
   ```bash
   python3 scripts/seed_dev_db.py
   ```
   *This command initializes a local D1 database, seeds it with a subset of dictionary and sentence data, and extracts audio files to `static/audio/`.*

3. **Start the App**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure
- `src/`: SvelteKit application code.
- `scripts/`: Python tooling for data management.
- `migrations/`: D1 database schema.
- `static/audio/`: Local audio storage (git ignored).
- `data/`: Temporary storage for data processing.

## Data Sources
- **Sentences**: The sentences and audio files are sourced from the [Ankidrone Sentence Pack](https://tatsumoto.neocities.org/blog/ankidrone-sentence-pack) by Tatsumoto.
- **Dictionary**: Japanese-English definitions are from JMdict, and Kanji information is from KANJIDIC2.

## Working with D1 Locally
Wrangler stores your local database state in the `.wrangler/` directory. If you ever need to reset your local database entirely:
```bash
rm -rf .wrangler
python3 scripts/seed_dev_db.py
```
