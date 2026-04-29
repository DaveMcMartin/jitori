CREATE TABLE IF NOT EXISTS sentence_rebuild (
	id TEXT PRIMARY KEY,
	source TEXT NOT NULL,
	audio_path TEXT NOT NULL,
	audio_url TEXT NOT NULL,
	sentence TEXT NOT NULL,
	translation TEXT NOT NULL,
	word TEXT NOT NULL DEFAULT '',
	word_definition TEXT NOT NULL DEFAULT '',
	sentence_length INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO sentence_rebuild (
	id,
	source,
	audio_path,
	audio_url,
	sentence,
	translation,
	word,
	word_definition,
	sentence_length,
	created_at
)
SELECT
	id,
	source,
	audio_path,
	audio_url,
	sentence,
	translation,
	word,
	word_definition,
	sentence_length,
	created_at
FROM sentence;

DROP TABLE sentence;
ALTER TABLE sentence_rebuild RENAME TO sentence;

CREATE INDEX IF NOT EXISTS idx_sentence_audio_path ON sentence(audio_path);
CREATE INDEX IF NOT EXISTS idx_sentence_source ON sentence(source);
CREATE INDEX IF NOT EXISTS idx_sentence_length ON sentence(sentence_length);
