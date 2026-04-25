import type { StoredSentence } from '$lib/types';

export type SentenceSearchPartOfSpeech = 'noun' | 'verb' | 'adjective' | 'unknown';

export type SentenceSearchExpansion = {
	normalizedQuery: string;
	baseForm: string;
	partOfSpeech: SentenceSearchPartOfSpeech;
	terms: string[];
};

export type SentenceSearchDetailedResult = {
	results: StoredSentence[];
	expansion: SentenceSearchExpansion | null;
};

type SentenceSearchResponse =
	| StoredSentence[]
	| {
			results?: StoredSentence[];
			expansion?: SentenceSearchExpansion;
	  };

export class SentenceSearchService {
	private readonly endpoint = '/api/sentences/search';

	private normalizeUrl(url: string): string {
		return url.replace(/\/$/, '');
	}

	private normalizeResult(entry: Partial<StoredSentence>): StoredSentence {
		return {
			id: entry.id || crypto.randomUUID(),
			source: entry.source || '',
			audioPath: entry.audioPath || '',
			audioUrl: entry.audioUrl || '',
			sentence: entry.sentence || '',
			translation: entry.translation || '',
			word: entry.word || '',
			wordDefinition: entry.wordDefinition || '',
			createdAt: entry.createdAt || ''
		};
	}

	async searchDetailed(query: string, limit = 50): Promise<SentenceSearchDetailedResult> {
		const response = await fetch(this.normalizeUrl(this.endpoint), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				query,
				limit
			})
		});

		if (!response.ok) {
			throw new Error(`Sentence search failed: ${response.status} ${response.statusText}`);
		}

		const payload = (await response.json()) as SentenceSearchResponse;
		const results = Array.isArray(payload) ? payload : payload.results ?? [];
		const expansion = Array.isArray(payload) ? null : payload.expansion ?? null;
		return {
			results: results.map((item) => this.normalizeResult(item)),
			expansion
		};
	}

	async search(query: string, limit = 50): Promise<StoredSentence[]> {
		const detailed = await this.searchDetailed(query, limit);
		return detailed.results;
	}
}

export const sentenceSearchService = new SentenceSearchService();
