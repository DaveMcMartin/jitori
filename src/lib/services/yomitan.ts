import type { WordDefinition } from '$lib/types';

export class YomitanService {
	private enabled: boolean = false;
	private url: string = 'http://127.0.0.1:8766';

	configure(enabled: boolean, url: string = 'http://127.0.0.1:8766'): void {
		this.enabled = enabled;
		this.url = url;
	}

	async lookupWord(word: string): Promise<WordDefinition | null> {
		if (!this.enabled) return null;

		try {
			const response = await fetch(`${this.url}/lookup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ word })
			});

			if (!response.ok) return null;

			const data = await response.json();
			return {
				word: data.word || word,
				reading: data.reading || '',
				meaning: data.definitions?.join('; ') || '',
				partOfSpeech: data.partOfSpeech || ''
			};
		} catch {
			return null;
		}
	}

	async isAvailable(): Promise<boolean> {
		if (!this.enabled) return false;

		try {
			const response = await fetch(`${this.url}/health`, {
				method: 'GET',
				signal: AbortSignal.timeout(2000)
			});
			return response.ok;
		} catch {
			return false;
		}
	}
}

export const yomitanService = new YomitanService();
