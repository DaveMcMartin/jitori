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
	if (!value || Number.isNaN(value)) {
		return DEFAULT_LIMIT;
	}

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

function createInstrClause(column: string, size: number): string {
	return Array.from({ length: size }, () => `instr(${column}, ?) > 0`).join(' OR ');
}

export async function searchSentences(db: any, query: string, limit: number): Promise<SentenceSearchResult> {
	const expansion = expandSearchQuery(query);
	if (!expansion.normalizedQuery || expansion.terms.length === 0) {
		return { results: [], expansion };
	}

	const normalizedLimit = normalizeSearchLimit(limit);
	const loweredTerms = expansion.terms.map((term) => term.toLowerCase());
	const sentenceClause = createInstrClause('sentence', expansion.terms.length);
	const wordClause = createInstrClause('word', expansion.terms.length);
	const translationClause = createInstrClause('lower(translation)', loweredTerms.length);
	const sourceClause = createInstrClause('lower(source)', loweredTerms.length);
	const wildcardClause = `${sentenceClause} OR ${wordClause} OR ${translationClause} OR ${sourceClause}`;
	const result = (await db
		.prepare(
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
				${wildcardClause}
			ORDER BY
				CASE
					WHEN sentence = ? THEN 0
					WHEN instr(sentence, ?) = 1 THEN 1
					WHEN word = ? THEN 2
					WHEN instr(word, ?) = 1 THEN 3
					WHEN lower(translation) = ? THEN 4
					WHEN instr(lower(translation), ?) = 1 THEN 5
					WHEN lower(source) = ? THEN 6
					ELSE 7
				END,
				length(sentence) ASC,
				sentence ASC
			LIMIT ?
			`
		)
		.bind(
			...expansion.terms,
			...expansion.terms,
			...loweredTerms,
			...loweredTerms,
			expansion.normalizedQuery,
			expansion.normalizedQuery,
			expansion.baseForm,
			expansion.baseForm,
			expansion.normalizedQuery.toLowerCase(),
			expansion.normalizedQuery.toLowerCase(),
			expansion.normalizedQuery.toLowerCase(),
			normalizedLimit
		)
		.all()) as { results?: SentenceRow[] };

	return {
		results: (result.results ?? []).map(mapSentenceRow),
		expansion
	};
}
