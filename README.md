# Jitori - Japanese Sentence Bank

A Japanese sentence search application with conjugation-aware lookup, audio playback, and Anki export.

## Features

- **Sentences Table**: 58,000+ real Japanese sentences with high-quality audio.
- **Unified Dictionary**: Integrated JMdict and KANJIDICT entries.
- **Quick Dev Setup**: Seed your local environment in seconds.
- **Anki Integration**: Direct export to Anki via AnkiConnect.

## Getting Started

### 1. Prerequisites
- Node.js 18+
- Python 3.12+ (for data management)

### 2. Quick Start (Development)
After cloning the repo, you can immediately start the application. The setup script now creates a local D1 database pre-populated with dummy data so you don't need to download massive dictionary files manually.

```bash
npm install
npm run setup
npm run dev
```
This script will:
- Initialize your local D1 database using local `.sqlite` state.
- Seed it with some dummy sentences, dictionary entries, and kanji for immediate local testing.
- Create placeholder audio files in `static/audio/`.

### 3. Production Deployment
To deploy your own instance to Cloudflare:

1. **Create Database:**
   ```bash
   npx wrangler d1 create jitori
   ```
2. **Apply Migrations:**
   ```bash
   npx wrangler d1 migrations apply jitori --remote
   ```
3. **Import Full Data:**
   Use the high-performance bulk import scripts:
   ```bash
   # Import Sentences (58k)
   python3 scripts/import_sentences_to_d1.py
   
   # Import Dictionary (226k)
   python3 scripts/import_dictionaries_to_d1.py
   ```
4. **Deploy:**
   ```bash
   npm run build
   npx wrangler deploy
   ```

## Configuration

### Wrangler
Update `wrangler.toml` with your specific `database_id` and R2 bucket details.

### Anki
Configure your deck name and note type in the app settings sidebar.

## Project Structure
- `src/`: SvelteKit application code.
- `scripts/`: Data parsing and D1/R2 management tooling.
- `migrations/`: D1 database schema definitions.
- `static/audio/`: Local audio storage (git ignored, populated by scripts).
- `data/`: Temporary SQL files and state databases.
