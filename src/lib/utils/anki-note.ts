import type { AnkiNoteInput, DictionaryEntry } from '$lib/types';

export function buildWordAnkiInput(entry: DictionaryEntry): AnkiNoteInput {
	const word = entry.primaryKanji || entry.primaryReading;
	return {
		sentence: word,
		translation: '',
		word,
		wordDefinition: entry.gloss
	};
}
