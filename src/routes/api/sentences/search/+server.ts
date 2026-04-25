import { json } from '@sveltejs/kit';
import { normalizeSearchLimit, searchSentences } from '$lib/server/sentences';

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
		return json({ error: 'D1 binding is not configured.' }, { status: 500 });
	}

	const search = await searchSentences(db, query, limit);
	return json(search);
}

export async function GET({ url, platform }) {
	const query = url.searchParams.get('q') ?? '';
	const limit = normalizeSearchLimit(Number(url.searchParams.get('limit') ?? undefined));
	return runSearch(platform, query, limit);
}

export async function POST({ request, platform }) {
	const payload = (await request.json().catch(() => ({}))) as SearchRequest;
	const query = payload.query ?? '';
	const limit = normalizeSearchLimit(payload.limit);
	return runSearch(platform, query, limit);
}
