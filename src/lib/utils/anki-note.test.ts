import { describe, it, expect } from 'vitest';
import { buildWordAnkiInput } from './anki-note';
import type { DictionaryEntry } from '$lib/types';

describe('buildWordAnkiInput', () => {
	it('uses the kanji form as both the word and the phrase', () => {
		const entry: DictionaryEntry = {
			entSeq: 127810,
			primaryKanji: '食べる',
			primaryReading: 'たべる',
			gloss: 'to eat',
			partsOfSpeech: ['verb']
		};

		expect(buildWordAnkiInput(entry)).toEqual({
			sentence: '食べる',
			translation: '',
			word: '食べる',
			wordDefinition: 'to eat'
		});
	});

	it('falls back to the reading when the entry has no kanji', () => {
		const entry: DictionaryEntry = {
			entSeq: 1587020,
			primaryKanji: '',
			primaryReading: 'すし',
			gloss: 'sushi',
			partsOfSpeech: ['noun']
		};

		const input = buildWordAnkiInput(entry);

		expect(input.word).toBe('すし');
		expect(input.sentence).toBe('すし');
		expect(input.wordDefinition).toBe('sushi');
		expect(input.translation).toBe('');
	});
});
