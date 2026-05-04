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

	it('should handle complex mixed-quote and plain-string segments', () => {
		const input = "[{'content': [{'content': '(I) will', 'tag': 'li'}, {'content': '(I) shall', 'tag': 'li'}], 'data': {'content': 'glossary'}, 'lang': 'en', 'style': {'listStyleType': 'circle'}, 'tag': 'ul'}, {'content': {'content': 'on non-五段 stem, e.g. 食べる→食べよう; indicates intention', 'tag': 'li'}, 'data': {'content': 'notes'}, 'lang': 'ja', 'style': {'listStyleType': \"'📝 '\"}, 'tag': 'ul'}]; [{'content': {'content': \"let's\", 'tag': 'li'}, 'data': {'content': 'glossary'}, 'lang': 'en', 'style': {'listStyleType': 'circle'}, 'tag': 'ul'}, {'content': {'content': 'on non-五段 stem; indicates suggestion or invitation', 'tag': 'li'}, 'data': {'content': 'notes'}, 'lang': 'ja', 'style': {'listStyleType': \"'📝 '\"}, 'tag': 'ul'}]; [{'content': [{'content': '(I) wonder (if)', 'tag': 'li'}, {'content': 'might it be (that)', 'tag': 'li'}, {'content': 'maybe', 'tag': 'li'}, {'content': 'perhaps', 'tag': 'li'}, {'content': 'perchance', 'tag': 'li'}], 'data': {'content': 'glossary'}, 'lang': 'en', 'style': {'listStyleType': 'circle'}, 'tag': 'ul'}, {'content': {'content': 'on non-五段 stem; indicates speculation', 'tag': 'li'}, 'data': {'content': 'notes'}, 'lang': 'ja', 'style': {'listStyleType': \"'📝 '\"}, 'tag': 'ul'}]; よう";
		const expected = "(I) will; (I) shall; on non-五段 stem, e.g. 食べる→食べよう; indicates intention; let's; on non-五段 stem; indicates suggestion or invitation; (I) wonder (if); might it be (that); maybe; perhaps; perchance; on non-五段 stem; indicates speculation; よう";
		expect(parseGloss(input)).toBe(expected);
	});

	it('should handle corrupted JSON from production SQL replace', () => {
		const input = '{"content": {"content": "to eat", "tag": "li"}, "data": {"content": "glossary"}, "lang": "en", "style": {"listStyleType": "circle"}, "tag": "ul"}; {"content": [{"content": "to live on (e.g. a salary)", "tag": "li"}, {"content": "to live off", "tag": "li"}, {"content": "to subsist on", "tag": "li"}], "data": {"content": "glossary"}, "lang": "en", "style": {"listStyleType": "circle"}, "tag": "ul"}';
		expect(parseGloss(input)).toBe("to eat; to live on (e.g. a salary); to live off; to subsist on");
	});

	it('should handle double-double quotes formatting', () => {
		const input = '{"content": {"content": "voiced repetition mark in katakana", "tag": "li"}, "data": {"content": "infoGlossary"}, "lang": "en", "style": {"listStyleType": ""ℹ️ ""}, "tag": "ul"}';
		expect(parseGloss(input)).toBe("voiced repetition mark in katakana");
	});

	it('should handle unescaped quotes inside double quoted strings', () => {
		const input = '{"content": [{"content": "one"s school", "tag": "li"}, {"content": "school one attends or works at", "tag": "li"}], "data": {"content": "glossary"}, "lang": "en", "style": {"listStyleType": "circle"}, "tag": "ul"}; [{"content": {"content": "driving school", "tag": "li"}, "data": {"content": "glossary"}, "lang": "en", "style": {"listStyleType": "circle"}, "tag": "ul"}, {"content": {"content": ["see: ", {"content": "自動車学校", "href": "?query=自動車学校&wildcards=off", "lang": "ja", "tag": "a"}, {"content": " driving school", "data": {"content": "refGlosses"}, "style": {"fontSize": "65%", "verticalAlign": "middle"}, "tag": "span"}], "tag": "li"}, "data": {"content": "references"}, "lang": "en", "style": {"listStyleType": ""➡️ ""}, "tag": "ul"}]';
		expect(parseGloss(input)).toBe("one\"s school; school one attends or works at; driving school; see: 自動車学校 driving school");
	});
});
