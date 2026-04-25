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

function classifyPartOfSpeech(query: string): PartOfSpeech {
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
	const candidates = deriveDictionaryCandidates(query);
	const allForms: string[] = [query];
	let baseForm = candidates[0];

	for (const candidate of candidates) {
		baseForm = candidate;
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

	const partOfSpeech = classifyPartOfSpeech(normalizedQuery);
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
