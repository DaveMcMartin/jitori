import { json } from '@sveltejs/kit';
import { normalizeDictionaryLimit, searchDictionary, searchKanji } from '$lib/server/dictionary';

type SearchRequest = {
	query?: string;
	limit?: number;
};

function getDatabase(platform: App.Platform | undefined): any {
	return platform?.env?.DB ?? null;
}

async function runSearch(platform: App.Platform | undefined, query: string, limit: number) {
	const db = getDatabase(platform);
	if (!db) {
		return json({ error: 'Dictionary D1 binding is not configured.' }, { status: 500 });
	}
	const [entries, kanji] = await Promise.all([searchDictionary(db, query, limit), searchKanji(db, query, 12)]);
	return json({ entries, kanji });
}

export async function GET({ url, platform }) {
	const query = url.searchParams.get('q') ?? '';
	const limit = normalizeDictionaryLimit(Number(url.searchParams.get('limit') ?? undefined));
	return runSearch(platform, query, limit);
}

export async function POST({ request, platform }) {
	const payload = (await request.json().catch(() => ({}))) as SearchRequest;
	const query = payload.query ?? '';
	const limit = normalizeDictionaryLimit(payload.limit);
	return runSearch(platform, query, limit);
}
