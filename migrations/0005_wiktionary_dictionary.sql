CREATE TABLE IF NOT EXISTS wiktionary_entry (
	id INTEGER PRIMARY KEY,
	primary_kanji TEXT NOT NULL,
	primary_reading TEXT NOT NULL,
	definition TEXT NOT NULL,
	parts_of_speech TEXT NOT NULL,
	source_url TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wiktionary_term (
	term TEXT NOT NULL,
	entry_id INTEGER NOT NULL,
	term_kind TEXT NOT NULL,
	PRIMARY KEY (term, entry_id, term_kind),
	FOREIGN KEY (entry_id) REFERENCES wiktionary_entry(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wiktionary_entry_primary_kanji ON wiktionary_entry(primary_kanji);
CREATE INDEX IF NOT EXISTS idx_wiktionary_entry_primary_reading ON wiktionary_entry(primary_reading);
CREATE INDEX IF NOT EXISTS idx_wiktionary_term_term ON wiktionary_term(term);
CREATE INDEX IF NOT EXISTS idx_wiktionary_term_entry_id ON wiktionary_term(entry_id);
