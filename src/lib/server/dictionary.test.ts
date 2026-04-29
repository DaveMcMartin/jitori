import { describe, it, expect } from 'vitest';
import { normalizeDictionaryLimit, parseGloss, extractText } from './dictionary';

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


describe('parseGloss', () => {
	it('should return regular string as is', () => {
		expect(parseGloss("to eat")).toBe("to eat");
	});

	it('should parse simple JSON array gloss', () => {
		expect(parseGloss('["to eat", "to live"]')).toBe("to eat; to live");
	});

	it('should parse nested JSON structure', () => {
		const jsonGloss = '[{"content": {"content": "repetition mark in katakana", "tag": "li"}, "data": {"content": "glossary"}, "lang": "en", "style": {"listStyleType": "circle"}, "tag": "ul"}, {"content": {"content": ["see: ", {"content": "一の字点", "href": "?query=一の字点&wildcards=off", "lang": "ja", "tag": "a"}, {"content": " kana iteration mark", "data": {"content": "refGlosses"}, "style": {"fontSize": "65%", "verticalAlign": "middle"}, "tag": "span"}], "tag": "li"}, "data": {"content": "references"}, "lang": "en", "style": {"listStyleType": "➡️ "}, "tag": "ul"}]';
		expect(parseGloss(jsonGloss)).toBe("repetition mark in katakana; see: 一の字点 kana iteration mark");
	});

	it('should parse valid JSON object', () => {
		expect(parseGloss('{"content": "something"}')).toBe("something");
	});

	it('should parse multiple JSON segments separated by semicolon', () => {
		const input = '{"content": "eat"}; {"content": [{"content": "live", "tag": "li"}, {"content": "subsist", "tag": "li"}]}';
		expect(parseGloss(input)).toBe("eat; live; subsist");
	});
});
