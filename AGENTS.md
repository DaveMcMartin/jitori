# Agent Instructions for Jitori

This document outlines the architecture, coding standards, and workflows for the Jitori project. All agents working on this codebase must adhere to these guidelines.

## Core Mandates
- **Follow Clean Code practices and SOLID principles.**
- **NO CODE COMMENTS.** Code must be self-documenting through clear naming and small, focused functions.

## Tech Stack
- **Frontend/Backend:** SvelteKit (Svelte 5) with TypeScript.
- **Database:** Cloudflare D1 (SQLite-compatible).
- **Storage:** Cloudflare R2 for audio assets.
- **Testing:** Vitest for unit and integration tests.
- **Data Pipeline:** Python 3.12+ for processing and importing dictionary/sentence data.

## Coding Standards

### TypeScript / Svelte
- Use **Svelte 5** features (Runes, snippets) when applicable.
- Use **CamelCase** for variables, functions, and file names (except for Svelte components which use PascalCase).
- Prefer **functional programming** patterns where appropriate (e.g., `map`, `filter`, `reduce`).
- Ensure exhaustive type safety. Avoid `any` at all costs.
- Data fetching should be handled in `+page.server.ts` or `+server.ts` routes.

### Python
- Follow **PEP 8** style guidelines.
- Use **snake_case** for variables and functions.
- Use type hints for all function signatures.
- Prefer `pathlib` over `os.path`.

### Database
- Use **snake_case** for table and column names.
- Map database rows to camelCase TypeScript interfaces in the application layer (see `mapSentenceRow` in `src/lib/server/sentences.ts`).
- Migrations are stored in `migrations/` and should be managed via Wrangler.

## Architecture

### Clean Code & SOLID
- **Single Responsibility:** Classes and functions should do one thing.
- **Open/Closed:** Entities should be open for extension but closed for modification.
- **Liskov Substitution:** Subtypes must be substitutable for their base types.
- **Interface Segregation:** Clients should not be forced to depend on methods they do not use.
- **Dependency Inversion:** Depend on abstractions, not concretions.

### Project Structure
- `src/lib/server/`: Core business logic and database interactions.
- `src/lib/services/`: External integrations (e.g., Anki, Yomitan).
- `src/lib/components/`: Reusable Svelte components.
- `scripts/`: Standalone Python scripts for data management.

## Testing & Validation
- Write tests for all new business logic in `*.test.ts`.
- Run `npm test` to verify changes.
- Ensure type-checking passes with `npm run check`.

## Japanese NLP Specifics
- Search logic uses conjugation-aware lookup.
- Be mindful of character encodings and Japanese-specific string manipulations.
- Dictionary data comes from JMdict and KANJIDICT.
