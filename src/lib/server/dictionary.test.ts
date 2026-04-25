import { describe, it, expect } from 'vitest';
import { normalizeDictionaryLimit } from './dictionary';

describe('normalizeDictionaryLimit', () => {
	it('should return default limit (20) if value is null or undefined or NaN', () => {
		expect(normalizeDictionaryLimit(null)).toBe(20);
		expect(normalizeDictionaryLimit(undefined)).toBe(20);
		expect(normalizeDictionaryLimit(NaN)).toBe(20);
	});

	it('should clamp values below 1 to 1', () => {
		expect(normalizeDictionaryLimit(0)).toBe(1);
		expect(normalizeDictionaryLimit(-5)).toBe(1);
	});

	it('should clamp values above 50 to 50', () => {
		expect(normalizeDictionaryLimit(100)).toBe(50);
	});

	it('should return valid truncated values within bounds', () => {
		expect(normalizeDictionaryLimit(30)).toBe(30);
		expect(normalizeDictionaryLimit(30.5)).toBe(30);
	});
});
