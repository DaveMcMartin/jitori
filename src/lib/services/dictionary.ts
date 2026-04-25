import type { DictionaryEntry, KanjiEntry } from '$lib/types';

type SearchPayload = {
	entries?: DictionaryEntry[];
	kanji?: KanjiEntry[];
};

export class DictionaryService {
	private readonly searchEndpoint = '/api/dictionary/search';
	private readonly kanjiEndpoint = '/api/dictionary/kanji';

	private normalizeUrl(url: string): string {
		return url.replace(/\/$/, '');
	}

	async search(query: string, limit = 20): Promise<{ entries: DictionaryEntry[]; kanji: KanjiEntry[] }> {
		const response = await fetch(this.normalizeUrl(this.searchEndpoint), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ query, limit })
		});
		if (!response.ok) {
			throw new Error(`Dictionary search failed: ${response.status} ${response.statusText}`);
		}
		const payload = (await response.json()) as SearchPayload;
		return {
			entries: payload.entries ?? [],
			kanji: payload.kanji ?? []
		};
	}

	async getKanji(literal: string): Promise<KanjiEntry> {
		const encoded = encodeURIComponent(literal);
		const response = await fetch(`${this.normalizeUrl(this.kanjiEndpoint)}/${encoded}`);
		if (!response.ok) {
			throw new Error(`Kanji lookup failed: ${response.status} ${response.statusText}`);
		}
		return (await response.json()) as KanjiEntry;
	}
}

export const dictionaryService = new DictionaryService();
