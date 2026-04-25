import { json } from '@sveltejs/kit';
import { getKanji } from '$lib/server/dictionary';

function getDatabase(platform: App.Platform | undefined): any {
	return platform?.env?.DB ?? null;
}

export async function GET({ params, platform }) {
	const db = getDatabase(platform);
	if (!db) {
		return json({ error: 'Dictionary D1 binding is not configured.' }, { status: 500 });
	}
	const literal = decodeURIComponent(params.literal ?? '');
	const kanji = await getKanji(db, literal);
	if (!kanji) {
		return json({ error: 'Kanji not found.' }, { status: 404 });
	}
	return json(kanji);
}
