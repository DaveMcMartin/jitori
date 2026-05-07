import type { StoredSentence } from '$lib/types';
import { expandSearchQuery, type QueryExpansion } from '$lib/server/query-expansion';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type SentenceRow = {
	id: string;
	source: string;
	audioPath?: string;
	audio_path?: string;
	audioUrl?: string;
	audio_url?: string;
	sentence: string;
	translation: string;
	word?: string;
	word_definition?: string;
	wordDefinition?: string;
	createdAt?: string;
	created_at?: string;
};

export function normalizeSearchLimit(value: number | null | undefined): number {
	if (value === null || value === undefined || Number.isNaN(value)) {
		return DEFAULT_LIMIT;
	}
	if (value === 0) return 1;
	return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value)));
}

export function mapSentenceRow(row: SentenceRow): StoredSentence {
	return {
		id: row.id,
		source: row.source ?? '',
		audioPath: row.audioPath ?? row.audio_path ?? '',
		audioUrl: row.audioUrl ?? row.audio_url ?? '',
		sentence: row.sentence ?? '',
		translation: row.translation ?? '',
		word: row.word ?? '',
		wordDefinition: row.wordDefinition ?? row.word_definition ?? '',
		createdAt: row.createdAt ?? row.created_at ?? ''
	};
}

export type SentenceSearchResult = {
	results: StoredSentence[];
	expansion: QueryExpansion;
};



export async function searchSentences(db: any, query: string, limit: number): Promise<SentenceSearchResult> {
	const expansion = expandSearchQuery(query);
	if (!expansion.normalizedQuery || expansion.terms.length === 0) {
		return { results: [], expansion };
	}

	const normalizedLimit = normalizeSearchLimit(limit);

	const conditions: string[] = [];
	const binds: any[] = [];

	// Add search logic for each term
	for (const term of expansion.terms) {
	    const likeTerm = '%' + term + '%';
		conditions.push('(sentence LIKE ? OR word LIKE ? OR translation LIKE ?)');
		binds.push(likeTerm, likeTerm, likeTerm);
	}
    binds.push(normalizedLimit);

    // If we're hitting D1, we might need to await the results properly
    // db is expected to be a Cloudflare D1 database or better-sqlite3 instance
	const stmt = db.prepare(
		`
		SELECT
			id,
			source,
			audio_path,
			audio_url,
			sentence,
			translation,
			word,
			word_definition,
			created_at
		FROM sentence
		WHERE
			${conditions.join(' OR ')}
		ORDER BY
			sentence_length ASC,
			sentence ASC
		LIMIT ?
		`
	).bind(...binds);

	const result = (await stmt.all()) as { results?: SentenceRow[] };
    // better-sqlite3 returns an array directly, whereas Cloudflare D1 returns an object with results
    const rows = Array.isArray(result) ? result : (result.results ?? []);

	return {
		results: rows.map(mapSentenceRow),
		expansion
	};
}
