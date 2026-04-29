CREATE TABLE IF NOT EXISTS jmdict_entry (
	ent_seq INTEGER PRIMARY KEY,
	primary_kanji TEXT NOT NULL,
	primary_reading TEXT NOT NULL,
	gloss TEXT NOT NULL,
	parts_of_speech TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jmdict_term (
	term TEXT NOT NULL,
	ent_seq INTEGER NOT NULL,
	term_kind TEXT NOT NULL,
	is_primary INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (term, ent_seq, term_kind),
	FOREIGN KEY (ent_seq) REFERENCES jmdict_entry(ent_seq) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jmdict_entry_primary_kanji ON jmdict_entry(primary_kanji);
CREATE INDEX IF NOT EXISTS idx_jmdict_entry_primary_reading ON jmdict_entry(primary_reading);
CREATE INDEX IF NOT EXISTS idx_jmdict_term_term ON jmdict_term(term);
CREATE INDEX IF NOT EXISTS idx_jmdict_term_ent_seq ON jmdict_term(ent_seq);
CREATE INDEX IF NOT EXISTS idx_jmdict_term_lookup ON jmdict_term(term, term_kind);

CREATE TABLE IF NOT EXISTS kanjidict_entry (
	literal TEXT PRIMARY KEY,
	grade INTEGER,
	jlpt INTEGER,
	stroke_count INTEGER,
	frequency INTEGER,
	on_readings TEXT NOT NULL,
	kun_readings TEXT NOT NULL,
	nanori TEXT NOT NULL,
	meanings TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kanjidict_jlpt ON kanjidict_entry(jlpt);
CREATE INDEX IF NOT EXISTS idx_kanjidict_grade ON kanjidict_entry(grade);
CREATE INDEX IF NOT EXISTS idx_kanjidict_frequency ON kanjidict_entry(frequency);
