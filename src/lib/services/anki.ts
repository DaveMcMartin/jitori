import type { AnkiConfig, AnkiNoteInput } from '$lib/types';

export class AnkiService {
	private baseUrl: string = 'http://127.0.0.1:8765';
	private readonly devProxyPath: string = '/anki-connect';

	setUrl(url: string): void {
		this.baseUrl = url;
		console.info('[AnkiService] base URL updated', { baseUrl: url });
	}

	async checkConnection(): Promise<boolean> {
		try {
			const result = await this.request('version');
			console.info('[AnkiService] connection check passed', { version: result });
			return typeof result === 'number';
		} catch (error) {
			console.error('[AnkiService] connection check failed', { error });
			return false;
		}
	}

	async getDecks(): Promise<string[]> {
		return this.request('deckNames');
	}

	async getNoteTypes(): Promise<string[]> {
		return this.request('modelNames');
	}

	async getNoteFields(noteType: string): Promise<string[]> {
		return this.request('modelFieldNames', { modelName: noteType });
	}

	async addCard(
		config: AnkiConfig,
		note: AnkiNoteInput
	): Promise<number> {
		const fields: Record<string, string> = {};
		if (config.fields.sentence) fields[config.fields.sentence] = note.sentence;
		if (config.fields.translation) fields[config.fields.translation] = note.translation;
		if (config.fields.word) fields[config.fields.word] = note.word;
		if (config.fields.wordDefinition) fields[config.fields.wordDefinition] = note.wordDefinition;



				const audioObj = (config.fields.audio && note.audioUrl && note.audioFilename)
			? [{
				url: note.audioUrl,
				filename: note.audioFilename,
				fields: [config.fields.audio]
			}]
			: undefined;

		const result = await this.request('addNote', {
			note: {
				deckName: config.deckName,
				modelName: config.noteType,
				fields,
				options: {
					allowDuplicate: false,
					duplicateScope: 'deck'
				},
				...(audioObj ? { audio: audioObj } : {})
			}
		});

		return result;
	}

	async updateLastCard(
		config: AnkiConfig,
		note: AnkiNoteInput
	): Promise<void> {
		const recentCards = await this.request('findNotes', {
			query: `deck:"${config.deckName}" added:1`
		});

		if (recentCards.length === 0) {
			throw new Error('No recent cards found in deck');
		}

		const sortedCards = await this.request('notesInfo', { notes: recentCards });
		sortedCards.sort((a: { noteId: number }, b: { noteId: number }) => b.noteId - a.noteId);
		const lastCardId = sortedCards[0].noteId;

		const fields: Record<string, string> = {};
		if (config.fields.sentence) fields[config.fields.sentence] = note.sentence;
		if (config.fields.translation) fields[config.fields.translation] = note.translation;
		if (config.fields.word) fields[config.fields.word] = note.word;
		if (config.fields.wordDefinition) fields[config.fields.wordDefinition] = note.wordDefinition;



				await this.request('updateNoteFields', {
			note: {
				id: lastCardId,
				fields
			}
		});
	}


	async canAddNotesWithErrorDetail(
		config: AnkiConfig,
		note: AnkiNoteInput
	): Promise<{ canAdd: boolean; error?: string }[]> {
		const fields: Record<string, string> = {};
		if (config.fields.sentence) fields[config.fields.sentence] = note.sentence;
		if (config.fields.translation) fields[config.fields.translation] = note.translation;
		if (config.fields.word) fields[config.fields.word] = note.word;
		if (config.fields.wordDefinition) fields[config.fields.wordDefinition] = note.wordDefinition;

		const audioObj = (config.fields.audio && note.audioUrl && note.audioFilename)
			? [{
				url: note.audioUrl,
				filename: note.audioFilename,
				fields: [config.fields.audio]
			}]
			: undefined;

		const result = await this.request('canAddNotesWithErrorDetail', {
			notes: [
				{
					deckName: config.deckName,
					modelName: config.noteType,
					fields,
					...(audioObj ? { audio: audioObj } : {})
				}
			]
		});

		return result;
	}

	async openAddCard(config: AnkiConfig, note: AnkiNoteInput): Promise<void> {
		const fields: Record<string, string> = {};
		if (config.fields.sentence) fields[config.fields.sentence] = note.sentence;
		if (config.fields.translation) fields[config.fields.translation] = note.translation;
		if (config.fields.word) fields[config.fields.word] = note.word;
		if (config.fields.wordDefinition) fields[config.fields.wordDefinition] = note.wordDefinition;



						const audioObj = (config.fields.audio && note.audioUrl && note.audioFilename)
			? [{
				url: note.audioUrl,
				filename: note.audioFilename,
				fields: [config.fields.audio]
			}]
			: undefined;

		await this.request('guiAddCards', {
			note: {
				deckName: config.deckName,
				modelName: config.noteType,
				fields,
				...(audioObj ? { audio: audioObj } : {})
			}
		});
	}

	private async request(action: string, params?: Record<string, unknown>): Promise<any> {
		const endpoint = this.resolveEndpoint();
		console.info('[AnkiService] request started', { action, endpoint });

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, version: 6, params })
		});

		if (!response.ok) {
			const message = `AnkiConnect error: ${response.status} ${response.statusText}`;
			console.error('[AnkiService] request failed', { action, endpoint, message });
			throw new Error(message);
		}

		const data = await response.json();

		if (data.error) {
			console.error('[AnkiService] action error', { action, endpoint, error: data.error });
			throw new Error(data.error);
		}

		console.info('[AnkiService] request succeeded', { action, endpoint });

		return data.result;
	}

	private resolveEndpoint(): string {
		if (typeof window === 'undefined') {
			return this.baseUrl;
		}

		const isLocalWeb = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
		if (!isLocalWeb) {
			return this.baseUrl;
		}

		const normalized = this.baseUrl.replace(/\/$/, '');
		if (normalized === 'http://127.0.0.1:8765' || normalized === 'http://localhost:8765') {
			return this.devProxyPath;
		}

		return this.baseUrl;
	}
}

export const ankiService = new AnkiService();
