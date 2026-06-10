import {
	buildAdjectiveForms as generateAdjectiveForms,
	buildVerbForms as generateVerbForms
} from '$lib/utils/japanese-word-forms';

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'unknown';

export type QueryExpansion = {
	normalizedQuery: string;
	baseForm: string;
	partOfSpeech: PartOfSpeech;
	terms: string[];
};

const GODAN_U_ENDINGS = new Set(['う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'る']);
const GODAN_I_TO_U = new Map([
	['い', 'う'],
	['き', 'く'],
	['ぎ', 'ぐ'],
	['し', 'す'],
	['ち', 'つ'],
	['に', 'ぬ'],
	['び', 'ぶ'],
	['み', 'む'],
	['り', 'る']
]);

function toSet(values: string[]): string[] {
	return Array.from(new Set(values.filter(Boolean)));
}

function containsJapanese(value: string): boolean {
	return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

function getLastChar(value: string): string {
	return value[value.length - 1] ?? '';
}

function classifyPartOfSpeech(query: string, candidates: string[] = []): PartOfSpeech {
	if (!containsJapanese(query)) {
		return 'unknown';
	}
	if (query.endsWith('する') || query.endsWith('くる') || query.endsWith('来る')) {
		return 'verb';
	}
	if (query.endsWith('い') && query.length > 1) {
		return 'adjective';
	}
	if (/(くない|くなかった|くて|ければ)$/.test(query)) {
		return 'adjective';
	}
	if (query.endsWith('かった') && !query.endsWith('なかった')) {
		return 'adjective';
	}
	if (GODAN_U_ENDINGS.has(getLastChar(query)) || query.endsWith('る')) {
		return 'verb';
	}
	for (const candidate of candidates) {
		if (GODAN_U_ENDINGS.has(getLastChar(candidate)) || candidate.endsWith('る')) {
			return 'verb';
		}
	}
	for (const candidate of candidates) {
		if (candidate.endsWith('い') && candidate.length > 1) {
			return 'adjective';
		}
	}
	return 'noun';
}

function extractMasuStem(query: string): string | null {
	const suffixes = ['ませんでした', 'ません', 'ました', 'ます'];
	for (const suffix of suffixes) {
		if (query.endsWith(suffix) && query.length > suffix.length) {
			return query.slice(0, -suffix.length);
		}
	}
	return null;
}

function isDictionaryVerbForm(query: string): boolean {
	const hasDictionaryEnding =
		query.endsWith('する') || query.endsWith('くる') || query.endsWith('来る') || GODAN_U_ENDINGS.has(getLastChar(query));
	return hasDictionaryEnding && !/(ます|ました|ません|ない|なかった|て|た|で|だ|れる|せる|よう)$/.test(query);
}

function resolveVerbBase(query: string, candidates: string[]): string {
	if (isDictionaryVerbForm(query)) return query;

	const masuStem = extractMasuStem(query);
	if (masuStem) {
		if (masuStem.endsWith('し') && masuStem.length > 2) return `${masuStem.slice(0, -1)}する`;
		const mappedEnding = GODAN_I_TO_U.get(getLastChar(masuStem));
		if (mappedEnding) return `${masuStem.slice(0, -1)}${mappedEnding}`;
		return candidates.find((candidate) => candidate !== query) ?? query;
	}

	const negativeSuruMatch = query.match(/^(.{2,})しなかった$/);
	if (negativeSuruMatch) return `${negativeSuruMatch[1]}する`;

	const suruMatch = query.match(/^(.{2,})(した|して)$/);
	if (suruMatch) return `${suruMatch[1]}する`;

	return candidates.find((candidate) => candidate !== query) ?? query;
}

export function deriveDeinflections(query: string): string[] {
	const candidates = new Set<string>();
	candidates.add(query);

	const aToU = new Map([
		['わ', 'う'], ['か', 'く'], ['が', 'ぐ'], ['さ', 'す'],
		['た', 'つ'], ['な', 'ぬ'], ['ば', 'ぶ'], ['ま', 'む'], ['ら', 'る']
	]);
	const iToU = new Map([
		['い', 'う'], ['き', 'く'], ['ぎ', 'ぐ'], ['し', 'す'],
		['ち', 'つ'], ['に', 'ぬ'], ['び', 'ぶ'], ['み', 'む'], ['り', 'る']
	]);
	const eToU = new Map([
		['え', 'う'], ['け', 'く'], ['げ', 'ぐ'], ['せ', 'す'],
		['て', 'つ'], ['ね', 'ぬ'], ['べ', 'ぶ'], ['め', 'む'], ['れ', 'る']
	]);
	const oToU = new Map([
		['お', 'う'], ['こ', 'く'], ['ご', 'ぐ'], ['そ', 'す'],
		['と', 'つ'], ['の', 'ぬ'], ['ぼ', 'ぶ'], ['も', 'む'], ['ろ', 'る']
	]);

	const masuMatch = query.match(/^(.*?)(ません|ました|ましょう|ます)$/);
	if (masuMatch) {
		const stem = masuMatch[1];
		if (stem.endsWith('し') && stem.length > 2) candidates.add(`${stem.slice(0, -1)}する`);
		candidates.add(`${stem}る`);
		if (stem.length > 0) {
			const last = stem[stem.length - 1];
			if (iToU.has(last)) candidates.add(stem.slice(0, -1) + iToU.get(last));
		}
	}

	const naiMatch = query.match(/^(.*?)(なかった|ない)$/);
	if (naiMatch) {
		const stem = naiMatch[1];
		if (stem.length > 0) {
			if (stem.endsWith('し') && stem.length > 2) candidates.add(`${stem.slice(0, -1)}する`);
			const last = stem[stem.length - 1];
			if (aToU.has(last)) {
				candidates.add(stem.slice(0, -1) + aToU.get(last));
			}
			candidates.add(`${stem}る`);
		}
	}

	const teTaMatch = query.match(/^(.*?)(ていた|でいた|ている|でいる|てた|でた|ちゃった|じゃった|て|で|た|だ)$/);
	if (teTaMatch) {
		const stem = teTaMatch[1];
		const suffix = teTaMatch[2];

		if (suffix.startsWith('て') || suffix.startsWith('た') || suffix.startsWith('ちゃ')) {
			if (stem.length > 0) {
				const last = stem[stem.length - 1];
				if (last === 'っ') {
					if (stem.endsWith('行っ')) {
						candidates.add(stem.slice(0, -2) + '行く');
					} else {
						candidates.add(stem.slice(0, -1) + 'う');
						candidates.add(stem.slice(0, -1) + 'つ');
						candidates.add(stem.slice(0, -1) + 'る');
					}
				} else if (last === 'い') {
					candidates.add(stem.slice(0, -1) + 'く');
				} else if (last === 'し') {
					candidates.add(stem.slice(0, -1) + 'す');
				}
			}
			candidates.add(`${stem}る`);
		}

		if (suffix.startsWith('で') || suffix.startsWith('だ') || suffix.startsWith('じゃ')) {
			if (stem.length > 0) {
				const last = stem[stem.length - 1];
				if (last === 'ん') {
					candidates.add(stem.slice(0, -1) + 'む');
					candidates.add(stem.slice(0, -1) + 'ぶ');
					candidates.add(stem.slice(0, -1) + 'ぬ');
				} else if (last === 'い') {
					candidates.add(stem.slice(0, -1) + 'ぐ');
				}
			}
		}

		if (query === 'した') candidates.add('する');
		if (query === 'きた' || query === '来た') candidates.add('くる');
		if (query.endsWith('した') && query.length > 2) candidates.add(`${query.slice(0, -2)}する`);
		if (query.endsWith('して') && query.length > 2) candidates.add(`${query.slice(0, -2)}する`);
	}

	const reruMatch = query.match(/^(.*?)(られる|させる|される|れる|せる)$/);
	if (reruMatch) {
		const stem = reruMatch[1];
		const suffix = reruMatch[2];
		if (suffix === 'られる' || suffix === 'させる') {
			candidates.add(`${stem}る`);
		}
		if (suffix === 'れる' || suffix === 'せる' || suffix === 'される') {
			if (stem.length > 0) {
				const last = stem[stem.length - 1];
				if (suffix === 'れる' && aToU.has(last)) {
					candidates.add(stem.slice(0, -1) + aToU.get(last));
				}
				if (suffix === 'せる' && aToU.has(last)) {
					candidates.add(stem.slice(0, -1) + aToU.get(last));
				}
			}
		}
		if (suffix === 'される' && stem.endsWith('さ')) {
			candidates.add(stem.slice(0, -1) + 'する');
		}
	}

	if (query.endsWith('る') && query.length > 1) {
		const beforeRu = query[query.length - 2];
		if (eToU.has(beforeRu)) {
			candidates.add(query.slice(0, -2) + eToU.get(beforeRu));
		}
	}

	if (query.endsWith('よう')) {
		candidates.add(query.slice(0, -2) + 'る');
	}
	if (query.endsWith('う') && query.length > 1) {
		const beforeU = query[query.length - 2];
		if (oToU.has(beforeU)) {
			candidates.add(query.slice(0, -2) + oToU.get(beforeU));
		}
	}

	const adjMatch = query.match(/^(.*?)(かった|くない|くて|く|そう)$/);
	if (adjMatch) {
		const stem = adjMatch[1];
		if (stem.length > 0) {
			candidates.add(`${stem}い`);
		}
	}

	return Array.from(candidates);
}

function buildVerbForms(query: string): { baseForm: string; terms: string[] } {
	const candidates = deriveDeinflections(query);
	const baseForm = resolveVerbBase(query, candidates);
	const allForms = [query, ...generateVerbForms(baseForm)];

	return {
		baseForm,
		terms: toSet(allForms).slice(0, 60)
	};
}

function buildAdjectiveForms(query: string): { baseForm: string; terms: string[] } {
	const baseForm = query.endsWith('い')
		? query
		: (deriveDeinflections(query).find((candidate) => candidate !== query && candidate.endsWith('い')) ?? query);
	return {
		baseForm,
		terms: toSet([query, ...generateAdjectiveForms(baseForm)])
	};
}

function buildNounForms(query: string): { baseForm: string; terms: string[] } {
	return {
		baseForm: query,
		terms: toSet([query, `${query}だ`, `${query}です`, `${query}だった`, `${query}でした`])
	};
}

export function expandSearchQuery(query: string): QueryExpansion {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) {
		return {
			normalizedQuery: '',
			baseForm: '',
			partOfSpeech: 'unknown',
			terms: []
		};
	}

	const candidates = deriveDeinflections(normalizedQuery);
	const partOfSpeech = classifyPartOfSpeech(normalizedQuery, candidates);
	if (partOfSpeech === 'verb') {
		const verb = buildVerbForms(normalizedQuery);
		return { normalizedQuery, partOfSpeech, baseForm: verb.baseForm, terms: verb.terms };
	}
	if (partOfSpeech === 'adjective') {
		const adjective = buildAdjectiveForms(normalizedQuery);
		return { normalizedQuery, partOfSpeech, baseForm: adjective.baseForm, terms: adjective.terms };
	}
	if (partOfSpeech === 'noun') {
		const noun = buildNounForms(normalizedQuery);
		return { normalizedQuery, partOfSpeech, baseForm: noun.baseForm, terms: noun.terms };
	}

	return {
		normalizedQuery,
		baseForm: normalizedQuery,
		partOfSpeech: 'unknown',
		terms: [normalizedQuery]
	};
}
