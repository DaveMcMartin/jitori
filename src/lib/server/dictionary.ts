import { expandSearchQuery } from '$lib/server/query-expansion';
import type { DictionaryEntry, KanjiEntry } from '$lib/types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type DictionaryRow = {
	ent_seq: number;
	primary_kanji: string;
	primary_reading: string;
	gloss: string;
	parts_of_speech: string;
};

type KanjiRow = {
	literal: string;
	grade: number | null;
	jlpt: number | null;
	stroke_count: number | null;
	frequency: number | null;
	on_readings: string;
	kun_readings: string;
	nanori: string;
	meanings: string;
};

export function normalizeDictionaryLimit(value: number | null | undefined): number {
	if (value === null || value === undefined || Number.isNaN(value)) {
		return DEFAULT_LIMIT;
	}
	if (value === 0) return 1;
	return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value)));
}

function splitField(value: string): string[] {
	return value
		.split(';')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export function extractText(item: any): string {
	if (typeof item === 'string') return item;
	if (Array.isArray(item)) {
		// If the array consists mostly of structural blocks
		const isList = item.length > 1 && item.every((i) => i && typeof i === 'object' && ('tag' in i) && ['li', 'ul', 'ol'].includes(i.tag));
		const parts = item.map(extractText).map(s => s.trim()).filter(Boolean);
		return parts.join(isList ? '; ' : ' ');
	}
	if (item && typeof item === 'object') {
		if (item.text !== undefined) return extractText(item.text);
		if (item.content !== undefined) return extractText(item.content);
	}
	return '';
}

function splitGlosses(str: string): string[] {
	const result: string[] = [];
	let current = '';
	let inString = false;
	let stringChar = '';
	let brackets = 0;
	let braces = 0;

	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		const nextChar = str[i + 1];

		if (inString) {
			if (char === '\\') {
				current += char;
				if (nextChar !== undefined) {
					current += nextChar;
					i++;
				}
				continue;
			}
			if (char === stringChar) {
				const prevChar = i > 0 ? str[i - 1] : '';
				if (/[a-zA-Z]/.test(prevChar) && /[a-zA-Z]/.test(nextChar)) {
					current += char;
					continue;
				}
				inString = false;
			}
			current += char;
		} else {
			if (char === '"' || char === "'") {
				inString = true;
				stringChar = char;
				current += char;
			} else if (char === '{') {
				braces++;
				current += char;
			} else if (char === '}') {
				braces--;
				current += char;
			} else if (char === '[') {
				brackets++;
				current += char;
			} else if (char === ']') {
				brackets--;
				current += char;
			} else if (char === ';' && braces === 0 && brackets === 0) {
				result.push(current);
				current = '';
				if (nextChar === ' ') i++; // Skip following space
				continue;
			} else {
				current += char;
			}
		}
	}
	if (current) {
		result.push(current);
	}
	return result.map((s) => s.trim()).filter(Boolean);
}

function pythonReprToJson(str: string): string {
	let result = '';
	let inSingleQuote = false;
	let inDoubleQuote = false;

	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		const prev = i > 0 ? str[i - 1] : '';

		if (inSingleQuote) {
			if (char === "'" && prev !== '\\') {
				inSingleQuote = false;
				result += '"';
			} else if (char === '"') {
				result += '\\"';
			} else {
				result += char;
			}
		} else if (inDoubleQuote) {
			if (char === '"' && prev !== '\\') {
				inDoubleQuote = false;
			}
			result += char;
		} else {
			if (char === "'") {
				inSingleQuote = true;
				result += '"';
			} else if (char === '"') {
				inDoubleQuote = true;
				result += char;
			} else if (char === 'T' && str.substr(i, 4) === 'True') {
				result += 'true';
				i += 3;
			} else if (char === 'F' && str.substr(i, 5) === 'False') {
				result += 'false';
				i += 4;
			} else if (char === 'N' && str.substr(i, 4) === 'None') {
				result += 'null';
				i += 3;
			} else {
				result += char;
			}
		}
	}
	return result;
}

export function parseGloss(glossStr: string): string {
	if (!glossStr || (!glossStr.includes('{') && !glossStr.includes('['))) {
		return glossStr;
	}

	const segments = splitGlosses(glossStr);
	const parsedSegments = segments.map((segment) => {
		const trimmed = segment.trim();
		if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
			return trimmed;
		}

		// Fix double-double quotes from broken SQL replace
		let jsonStr = trimmed.replace(/""([^"]+)""/g, '"$1"');
		jsonStr = jsonStr.replace(/([a-zA-Z])"([a-zA-Z])/g, '$1\\"$2');
		jsonStr = jsonStr.replace(/([a-zA-Z])"([a-zA-Z])/g, '$1\\"$2');

		try {
			const parsed = JSON.parse(jsonStr);
			if (Array.isArray(parsed)) {
				return parsed.map(extractText).filter(Boolean).join('; ');
			}
			return extractText(parsed);
		} catch {
			try {
				const converted = pythonReprToJson(jsonStr);
				const parsed = JSON.parse(converted);
				if (Array.isArray(parsed)) {
					return parsed.map(extractText).filter(Boolean).join('; ');
				}
				return extractText(parsed);
			} catch {
				return trimmed;
			}
		}
	});

	return parsedSegments.filter(Boolean).join('; ');
}

function mapDictionaryRow(row: DictionaryRow): DictionaryEntry {
	return {
		entSeq: row.ent_seq,
		primaryKanji: row.primary_kanji,
		primaryReading: row.primary_reading,
		gloss: parseGloss(row.gloss),
		partsOfSpeech: splitField(row.parts_of_speech)
	};
}

function mapKanjiRow(row: KanjiRow): KanjiEntry {
	return {
		literal: row.literal,
		grade: row.grade,
		jlpt: row.jlpt,
		strokeCount: row.stroke_count,
		frequency: row.frequency,
		onReadings: splitField(row.on_readings),
		kunReadings: splitField(row.kun_readings),
		nanori: splitField(row.nanori),
		meanings: splitField(row.meanings)
	};
}

export async function searchDictionary(db: any, query: string, limit: number): Promise<DictionaryEntry[]> {
	const normalized = query.trim();
	if (!normalized) {
		return [];
	}

	const expansion = expandSearchQuery(normalized);
	const baseForm = expansion.baseForm || normalized;
	const normalizedLimit = normalizeDictionaryLimit(limit);
	const lower = normalized.toLowerCase();

	const result = (await db
		.prepare(
			`
			SELECT
				e.ent_seq,
				e.primary_kanji,
				e.primary_reading,
				e.gloss,
				e.parts_of_speech
			FROM jmdict_entry e
			LEFT JOIN jmdict_term t ON t.ent_seq = e.ent_seq
			WHERE
				t.term = ?
				OR t.term LIKE ?
				OR e.primary_kanji = ?
				OR e.primary_kanji LIKE ?
				OR e.primary_reading = ?
				OR e.primary_reading LIKE ?
				OR lower(e.gloss) LIKE ?
			GROUP BY e.ent_seq
			ORDER BY
				CASE
					WHEN t.term = ? THEN 0
					WHEN e.primary_kanji = ? THEN 1
					WHEN e.primary_reading = ? THEN 2
					ELSE 3
				END,
				length(e.primary_kanji) ASC,
				e.ent_seq ASC
			LIMIT ?
			`
		)
		.bind(
			normalized,
			`${normalized}%`,
			baseForm,
			`${baseForm}%`,
			baseForm,
			`${baseForm}%`,
			`%${lower}%`,
			normalized,
			baseForm,
			baseForm,
			normalizedLimit
		)
		.all()) as { results?: DictionaryRow[] };
	return (result.results ?? []).map(mapDictionaryRow);
}

export async function searchKanji(db: any, query: string, limit: number): Promise<KanjiEntry[]> {
	const chars = Array.from(query.trim()).filter((char) => /[\u3400-\u9fff]/u.test(char));
	if (chars.length === 0) {
		return [];
	}
	const unique = Array.from(new Set(chars)).slice(0, normalizeDictionaryLimit(limit));
	const placeholders = unique.map(() => '?').join(', ');
	const result = (await db
		.prepare(
			`
			SELECT
				literal,
				grade,
				jlpt,
				stroke_count,
				frequency,
				on_readings,
				kun_readings,
				nanori,
				meanings
			FROM kanjidict_entry
			WHERE literal IN (${placeholders})
			ORDER BY literal ASC
			`
		)
		.bind(...unique)
		.all()) as { results?: KanjiRow[] };
	return (result.results ?? []).map(mapKanjiRow);
}

export async function getKanji(db: any, literal: string): Promise<KanjiEntry | null> {
	if (!/^[\u3400-\u9fff]$/u.test(literal)) {
		return null;
	}
	const row = (await db
		.prepare(
			`
			SELECT
				literal,
				grade,
				jlpt,
				stroke_count,
				frequency,
				on_readings,
				kun_readings,
				nanori,
				meanings
			FROM kanjidict_entry
			WHERE literal = ?
			LIMIT 1
			`
		)
		.bind(literal)
		.first()) as KanjiRow | null;
	if (!row) {
		return null;
	}
	return mapKanjiRow(row);
}
