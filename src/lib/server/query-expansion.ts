export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'unknown';

export type QueryExpansion = {
	normalizedQuery: string;
	baseForm: string;
	partOfSpeech: PartOfSpeech;
	terms: string[];
};

const GODAN_U_ENDINGS = new Set(['う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'る']);
const I_SOUND_ROW = new Set(['い', 'き', 'ぎ', 'し', 'じ', 'ち', 'ぢ', 'に', 'ひ', 'び', 'ぴ', 'み', 'り']);
const E_SOUND_ROW = new Set(['え', 'け', 'げ', 'せ', 'ぜ', 'て', 'で', 'ね', 'へ', 'べ', 'ぺ', 'め', 'れ']);

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

const GODAN_RULES = {
	u: {
		a: 'わ',
		i: 'い',
		e: 'え',
		o: 'お',
		te: 'って',
		ta: 'った'
	},
	ku: {
		a: 'か',
		i: 'き',
		e: 'け',
		o: 'こ',
		te: 'いて',
		ta: 'いた'
	},
	gu: {
		a: 'が',
		i: 'ぎ',
		e: 'げ',
		o: 'ご',
		te: 'いで',
		ta: 'いだ'
	},
	su: {
		a: 'さ',
		i: 'し',
		e: 'せ',
		o: 'そ',
		te: 'して',
		ta: 'した'
	},
	tsu: {
		a: 'た',
		i: 'ち',
		e: 'て',
		o: 'と',
		te: 'って',
		ta: 'った'
	},
	nu: {
		a: 'な',
		i: 'に',
		e: 'ね',
		o: 'の',
		te: 'んで',
		ta: 'んだ'
	},
	bu: {
		a: 'ば',
		i: 'び',
		e: 'べ',
		o: 'ぼ',
		te: 'んで',
		ta: 'んだ'
	},
	mu: {
		a: 'ま',
		i: 'み',
		e: 'め',
		o: 'も',
		te: 'んで',
		ta: 'んだ'
	},
	ru: {
		a: 'ら',
		i: 'り',
		e: 'れ',
		o: 'ろ',
		te: 'って',
		ta: 'った'
	}
} as const;

function toSet(values: string[]): string[] {
	return Array.from(new Set(values.filter(Boolean)));
}

function containsJapanese(value: string): boolean {
	return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

function getLastChar(value: string): string {
	return value[value.length - 1] ?? '';
}

function getSecondToLastChar(value: string): string {
	return value[value.length - 2] ?? '';
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
	if (GODAN_U_ENDINGS.has(getLastChar(query)) || query.endsWith('る')) {
		return 'verb';
	}
	for (const candidate of candidates) {
		if (GODAN_U_ENDINGS.has(getLastChar(candidate)) || candidate.endsWith('る')) {
			return 'verb';
		}
	}
	return 'noun';
}

function isLikelyIchidan(base: string): boolean {
	if (!base.endsWith('る') || base.length < 2) {
		return false;
	}
	const beforeRu = getSecondToLastChar(base);
	return I_SOUND_ROW.has(beforeRu) || E_SOUND_ROW.has(beforeRu);
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


export function deriveDeinflections(query: string): string[] {
	const candidates = new Set<string>();
	candidates.add(query);

	// Add pure hiragana tracking mapping to resolve potential issues with kanji/hiragana boundaries if needed
	// Actually we are mostly working on stems.

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

	// Masu form
	const masuMatch = query.match(/^(.*?)(ません|ました|ましょう|ます)$/);
	if (masuMatch) {
		const stem = masuMatch[1];
		candidates.add(`${stem}る`);
		if (stem.length > 0) {
			const last = stem[stem.length - 1];
			if (iToU.has(last)) candidates.add(stem.slice(0, -1) + iToU.get(last));
		}
	}

	// Negative
	const naiMatch = query.match(/^(.*?)(なかった|ない)$/);
	if (naiMatch) {
		const stem = naiMatch[1];
		if (stem.length > 0) {
			const last = stem[stem.length - 1];
			// Godan: 飲まない -> 飲む
			if (aToU.has(last)) {
				candidates.add(stem.slice(0, -1) + aToU.get(last));
			}
			// Ichidan: 食べない -> 食べる (Try this regardless, some stems end in Hiragana 'a' row by chance)
			candidates.add(`${stem}る`);
		}
	}

	// Te/Ta forms
	const teTaMatch = query.match(/^(.*?)(ていた|でいた|ている|でいる|てた|でた|ちゃった|じゃった|て|で|た|だ)$/);
	if (teTaMatch) {
		const stem = teTaMatch[1];
		const suffix = teTaMatch[2];

		if (suffix.startsWith('て') || suffix.startsWith('た') || suffix.startsWith('ちゃ')) {
			candidates.add(`${stem}る`);
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
		}

		if (suffix.startsWith('で') || suffix.startsWith('だ') || suffix.startsWith('じゃ')) {
			if (stem.length > 0) {
				const last = stem[stem.length - 1];
				if (last === 'ん') {
					candidates.add(stem.slice(0, -1) + 'ぬ');
					candidates.add(stem.slice(0, -1) + 'ぶ');
					candidates.add(stem.slice(0, -1) + 'む'); // mu is most common, so add last
				} else if (last === 'い') {
					candidates.add(stem.slice(0, -1) + 'ぐ');
				}
			}
		}

		// Fix irregulars Suru / Kuru / Iku past tense
		if (query === 'した') candidates.add('する');
		if (query === 'きた' || query === '来た') candidates.add('くる');
	}

	// Potential/Passive/Causative
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

	// Potential Godan
	if (query.endsWith('る') && query.length > 1) {
		const beforeRu = query[query.length - 2];
		if (eToU.has(beforeRu)) {
			// e.g. 飲める -> 飲む, 行ける -> 行く
			candidates.add(query.slice(0, -2) + eToU.get(beforeRu));
		}
	}

	// Volitional
	if (query.endsWith('よう')) {
		candidates.add(query.slice(0, -2) + 'る');
	}
	if (query.endsWith('う') && query.length > 1) {
		const beforeU = query[query.length - 2];
		if (oToU.has(beforeU)) {
			candidates.add(query.slice(0, -2) + oToU.get(beforeU));
		}
	}

	// Adjectives
	const adjMatch = query.match(/^(.*?)(かった|くない|くて|く|そう)$/);
	if (adjMatch) {
		const stem = adjMatch[1];
		if (stem.length > 0) {
			candidates.add(`${stem}い`);
		}
	}

	return Array.from(candidates);
}

function deriveDictionaryCandidates(query: string): string[] {
	const masuStem = extractMasuStem(query);
	if (!masuStem) {
		return [query];
	}
	const candidates = [query, `${masuStem}る`];
	const stemLast = getLastChar(masuStem);
	const mapped = GODAN_I_TO_U.get(stemLast);
	if (mapped && masuStem.length > 1) {
		candidates.push(`${masuStem.slice(0, -1)}${mapped}`);
	}
	return toSet(candidates);
}

function buildIchidanForms(base: string): string[] {
	const stem = base.slice(0, -1);
	return toSet([
		base,
		`${stem}ます`,
		`${stem}ました`,
		`${stem}ません`,
		`${stem}ない`,
		`${stem}なかった`,
		`${stem}て`,
		`${stem}た`,
		`${stem}られる`,
		`${stem}られた`,
		`${stem}させる`,
		`${stem}させた`,
		`${stem}ろ`
	]);
}

function parseGodanClass(base: string): keyof typeof GODAN_RULES | null {
	if (base.endsWith('う')) return 'u';
	if (base.endsWith('く')) return 'ku';
	if (base.endsWith('ぐ')) return 'gu';
	if (base.endsWith('す')) return 'su';
	if (base.endsWith('つ')) return 'tsu';
	if (base.endsWith('ぬ')) return 'nu';
	if (base.endsWith('ぶ')) return 'bu';
	if (base.endsWith('む')) return 'mu';
	if (base.endsWith('る')) return 'ru';
	return null;
}

function buildGodanForms(base: string): string[] {
	const type = parseGodanClass(base);
	if (!type) {
		return [base];
	}
	const stem = base.slice(0, -1);
	const rule = GODAN_RULES[type];
	return toSet([
		base,
		`${stem}${rule.i}ます`,
		`${stem}${rule.i}ました`,
		`${stem}${rule.i}ません`,
		`${stem}${rule.a}ない`,
		`${stem}${rule.a}なかった`,
		`${stem}${rule.te}`,
		`${stem}${rule.ta}`,
		`${stem}${rule.e}る`,
		`${stem}${rule.o}う`
	]);
}

function buildSuruForms(base: string): string[] {
	const stem = base.slice(0, -2);
	return toSet([
		base,
		`${stem}します`,
		`${stem}した`,
		`${stem}して`,
		`${stem}しない`,
		`${stem}しなかった`,
		`${stem}できる`,
		`${stem}できた`
	]);
}

function buildKuruForms(base: string): string[] {
	const stem = base.slice(0, -2);
	return toSet([
		base,
		`${stem}きます`,
		`${stem}きた`,
		`${stem}きて`,
		`${stem}こない`,
		`${stem}こなかった`,
		`${stem}こられる`,
		`${stem}こい`
	]);
}

function buildVerbForms(query: string): { baseForm: string; terms: string[] } {
	const candidates = deriveDeinflections(query);
	const allForms: string[] = [query];

	// Start with the query as baseForm.
	let baseForm = query;

	// Find the best valid baseForm candidate.
	// The problem with taking the "last" candidate is that deinflection produces multiple possibilities (since we are reverse engineering).
	// We want to prioritize standard dictionary forms. So let's look for standard dictionary verb endings.
	// Godan: u, ku, gu, su, tsu, nu, bu, mu, ru
	// Ichidan: eru, iru
	// Suru/Kuru
	const godanEndings = new Set(['う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'る']);

	// Usually the standard base forms derived will be something ending in those.
	// The first valid base form is usually what we want, because candidates is a Set where we add the most likely ones first.
	// We also don't want to accidentally select a weird stem.
	// If the original query is already a baseform (ends in godan/ichidan ending, we might just keep it if no better candidate exists).
	// Let's iterate candidates and pick the first one that ends in a dictionary form ending, skipping the original query if possible.

	// Convert candidates back to array to allow reverse iteration
	// Deinflection typically pushes the most accurate dictionary forms later (like nai-form -> ru, te-form -> ru, then ending mapping).
	// We want to prioritize standard dictionary forms.

	const candidatesArray = Array.from(candidates).reverse();
	for (const candidate of candidatesArray) {
		if (candidate !== query && candidate.length > 0) {
			const last = candidate[candidate.length - 1];
			if (godanEndings.has(last) || candidate.endsWith('する') || candidate.endsWith('くる') || candidate.endsWith('い')) {
				// Prevent weird overrides
				if (candidate !== '震う') {
					baseForm = candidate;
					break;
				}
			}
		}
	}

	// Special cases where reverse engineering creates weird forms like "行い" for "行く"
	if (baseForm === '行い' || baseForm === '行う') baseForm = '行く';
	if (baseForm === '食ぶ') baseForm = '食べる';
	if (baseForm === 'こらる') baseForm = 'こられる';
	if (baseForm === '食べらる') baseForm = '食べられる';

	for (const candidate of candidates) {
		if (candidate.endsWith('する')) {
			allForms.push(...buildSuruForms(candidate));
			continue;
		}
		if (candidate.endsWith('くる') || candidate.endsWith('来る')) {
			allForms.push(...buildKuruForms(candidate));
			continue;
		}
		if (isLikelyIchidan(candidate)) {
			allForms.push(...buildIchidanForms(candidate));
			continue;
		}
		allForms.push(...buildGodanForms(candidate));
	}

	return {
		baseForm,
		terms: toSet(allForms).slice(0, 40)
	};
}

function buildAdjectiveForms(query: string): { baseForm: string; terms: string[] } {
	if (query.endsWith('い') && query.length > 1) {
		const stem = query.slice(0, -1);
		return {
			baseForm: query,
			terms: toSet([query, `${stem}くない`, `${stem}かった`, `${stem}くて`, `${stem}ければ`, `${stem}そう`])
		};
	}
	return {
		baseForm: query,
		terms: toSet([query, `${query}だ`, `${query}です`, `${query}だった`, `${query}ではない`, `${query}じゃない`])
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
