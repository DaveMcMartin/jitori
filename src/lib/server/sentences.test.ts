import { describe, it, expect } from 'vitest';
import { normalizeSearchLimit, mapSentenceRow } from './sentences';

describe('normalizeSearchLimit', () => {
	it('should return default limit (25) if value is null or undefined or NaN', () => {
		expect(normalizeSearchLimit(null)).toBe(25);
		expect(normalizeSearchLimit(undefined)).toBe(25);
		expect(normalizeSearchLimit(NaN)).toBe(25);
	});

	it('should clamp values below 1 to 1', () => {
		expect(normalizeSearchLimit(0)).toBe(1);
		expect(normalizeSearchLimit(-10)).toBe(1);
	});

	it('should clamp values above 100 to 100', () => {
		expect(normalizeSearchLimit(150)).toBe(100);
	});

	it('should return valid truncated values within bounds', () => {
		expect(normalizeSearchLimit(50)).toBe(50);
		expect(normalizeSearchLimit(50.9)).toBe(50);
	});
});

describe('mapSentenceRow', () => {
	it('should correctly map row properties prioritizing camelCase over snake_case', () => {
		const row = {
			id: 'test-id',
			source: 'test-source',
			audioPath: 'path1',
			audio_path: 'path2',
			audioUrl: 'url1',
			audio_url: 'url2',
			sentence: 'test-sentence',
			translation: 'test-translation',
			word: 'test-word',
			wordDefinition: 'def1',
			word_definition: 'def2',
			createdAt: 'date1',
			created_at: 'date2'
		};

		const mapped = mapSentenceRow(row);
		expect(mapped).toEqual({
			id: 'test-id',
			source: 'test-source',
			audioPath: 'path1',
			audioUrl: 'url1',
			sentence: 'test-sentence',
			translation: 'test-translation',
			word: 'test-word',
			wordDefinition: 'def1',
			createdAt: 'date1'
		});
	});

	it('should correctly fallback to snake_case if camelCase is missing', () => {
		const row = {
			id: 'test-id',
			source: 'test-source',
			audio_path: 'path2',
			audio_url: 'url2',
			sentence: 'test-sentence',
			translation: 'test-translation',
			word: 'test-word',
			word_definition: 'def2',
			created_at: 'date2'
		};

		const mapped = mapSentenceRow(row);
		expect(mapped).toEqual({
			id: 'test-id',
			source: 'test-source',
			audioPath: 'path2',
			audioUrl: 'url2',
			sentence: 'test-sentence',
			translation: 'test-translation',
			word: 'test-word',
			wordDefinition: 'def2',
			createdAt: 'date2'
		});
	});

	it('should default to empty strings if both are missing', () => {
		const row = {
			id: 'test-id',
			source: null as any,
			sentence: null as any,
			translation: null as any
		};

		const mapped = mapSentenceRow(row);
		expect(mapped).toEqual({
			id: 'test-id',
			source: '',
			audioPath: '',
			audioUrl: '',
			sentence: '',
			translation: '',
			word: '',
			wordDefinition: '',
			createdAt: ''
		});
	});
});
