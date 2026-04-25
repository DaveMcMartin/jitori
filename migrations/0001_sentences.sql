CREATE TABLE IF NOT EXISTS sentence (
	id TEXT PRIMARY KEY,
	source TEXT NOT NULL,
	audio_path TEXT NOT NULL UNIQUE,
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
