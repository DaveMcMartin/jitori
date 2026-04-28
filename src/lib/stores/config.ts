import { writable } from 'svelte/store';
import type { AppConfig, Selection } from '$lib/types';

export const defaultConfig: AppConfig = {
	anki: {
		url: 'http://127.0.0.1:8765',
		deckName: '',
		noteType: '',
		fields: {
			sentence: '',
			translation: '',
			word: '',
			wordDefinition: ''
		}
	}
};

export const configStore = writable<AppConfig>(defaultConfig);
export const selectionStore = writable<Selection | null>(null);
