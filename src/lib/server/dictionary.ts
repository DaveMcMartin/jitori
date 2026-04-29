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
		return item.map(extractText).join('');
	}
	if (item && typeof item === 'object') {
		if (item.text !== undefined) return extractText(item.text);
		if (item.content !== undefined) return extractText(item.content);
	}
	return '';
}

export function parseGloss(glossStr: string): string {
	try {
		let jsonStr = glossStr;
		if (jsonStr.startsWith("[{'") || jsonStr.startsWith("{'")) {
			// Replace single quotes with double quotes, but NOT if they are inside double quotes (already escaped)
			// or if they are the markers like '➡️ ' which we want to keep as ' inside the resulting JSON string
			// Actually, if we convert ALL ' to ", then we need to handle cases where ' was inside a string.
			// The most common case here is Python's repr() of a list/dict.
			jsonStr = jsonStr.replace(/(\W)'|'(\W)/g, '$1"$2');
			// Fix cases where it replaced ' inside words like "it's" - though unlikely in this specific data
		}
		const parsed = JSON.parse(jsonStr);
		if (Array.isArray(parsed)) {
			return parsed.map(extractText).filter(Boolean).join('; ');
		}
		return extractText(parsed);
	} catch {
		// Fallback for tricky cases: try a simpler replace if the above failed
		try {
			const jsonStr = glossStr.replace(/'/g, '"').replace(/"➡️ "/g, "'➡️ '").replace(/"ℹ️ "/g, "'ℹ️ '");
			const parsed = JSON.parse(jsonStr);
			if (Array.isArray(parsed)) {
				return parsed.map(extractText).filter(Boolean).join('; ');
			}
			return extractText(parsed);
		} catch {
			return glossStr;
		}
	}
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
				OR e.primary_kanji LIKE ?
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
			`${normalized}%`,
			`${normalized}%`,
			`%${lower}%`,
			normalized,
			normalized,
			normalized,
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
