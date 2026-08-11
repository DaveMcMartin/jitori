import { json } from '@sveltejs/kit';
import {
	isDictionaryLanguage,
	normalizeDictionaryLanguage,
	normalizeDictionaryLimit,
	searchDictionary,
	searchKanji
} from '$lib/server/dictionary';
import type { DictionaryLanguage } from '$lib/types';

type SearchRequest = {
	query?: string;
	limit?: number;
	language?: DictionaryLanguage;
};

function getDatabase(platform: App.Platform | undefined): any {
	return platform?.env?.DB ?? null;
}

async function runSearch(platform: App.Platform | undefined, query: string, limit: number, language: DictionaryLanguage) {
	const db = getDatabase(platform);
	if (!db) {
		return json({ error: 'Dictionary D1 binding is not configured.' }, { status: 500 });
	}
	const [entries, kanji] = await Promise.all([
		searchDictionary(db, query, limit, language),
		searchKanji(db, query, 12)
	]);
	return json({ entries, kanji });
}

export async function GET({ url, platform }) {
	const query = url.searchParams.get('q') ?? '';
	const limit = normalizeDictionaryLimit(Number(url.searchParams.get('limit') ?? undefined));
	const languageValue = url.searchParams.get('language');
	if (languageValue !== null && !isDictionaryLanguage(languageValue)) {
		return json({ error: 'language must be "en" or "jp".' }, { status: 400 });
	}
	return runSearch(platform, query, limit, normalizeDictionaryLanguage(languageValue));
}

export async function POST({ request, platform }) {
	const payload = (await request.json().catch(() => ({}))) as SearchRequest;
	const query = payload.query ?? '';
	const limit = normalizeDictionaryLimit(payload.limit);
	if (payload.language !== undefined && !isDictionaryLanguage(payload.language)) {
		return json({ error: 'language must be "en" or "jp".' }, { status: 400 });
	}
	return runSearch(platform, query, limit, payload.language ?? 'en');
}
