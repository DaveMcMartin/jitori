export type JapanesePartOfSpeech = 'noun' | 'verb' | 'adjective' | 'unknown';

const GODAN_RULES = {
	う: { a: 'わ', i: 'い', e: 'え', o: 'お', te: 'って', ta: 'った' },
	く: { a: 'か', i: 'き', e: 'け', o: 'こ', te: 'いて', ta: 'いた' },
	ぐ: { a: 'が', i: 'ぎ', e: 'げ', o: 'ご', te: 'いで', ta: 'いだ' },
	す: { a: 'さ', i: 'し', e: 'せ', o: 'そ', te: 'して', ta: 'した' },
	つ: { a: 'た', i: 'ち', e: 'て', o: 'と', te: 'って', ta: 'った' },
	ぬ: { a: 'な', i: 'に', e: 'ね', o: 'の', te: 'んで', ta: 'んだ' },
	ぶ: { a: 'ば', i: 'び', e: 'べ', o: 'ぼ', te: 'んで', ta: 'んだ' },
	む: { a: 'ま', i: 'み', e: 'め', o: 'も', te: 'んで', ta: 'んだ' },
	る: { a: 'ら', i: 'り', e: 'れ', o: 'ろ', te: 'って', ta: 'った' }
} as const;

const ICHIDAN_PRECEDING_KANA = new Set([
	'い',
	'き',
	'ぎ',
	'し',
	'じ',
	'ち',
	'ぢ',
	'に',
	'ひ',
	'び',
	'ぴ',
	'み',
	'り',
	'え',
	'け',
	'げ',
	'せ',
	'ぜ',
	'て',
	'で',
	'ね',
	'へ',
	'べ',
	'ぺ',
	'め',
	'れ'
]);

const GODAN_RU_EXCEPTIONS = new Set([
	'入る',
	'帰る',
	'切る',
	'走る',
	'知る',
	'要る',
	'減る',
	'滑る',
	'喋る',
	'焦る',
	'限る',
	'握る',
	'参る',
	'混じる',
	'蹴る'
]);

function unique(values: string[]): string[] {
	return Array.from(new Set(values.filter(Boolean)));
}

export function isLikelyIchidanVerb(word: string): boolean {
	return (
		word.endsWith('る') &&
		!GODAN_RU_EXCEPTIONS.has(word) &&
		ICHIDAN_PRECEDING_KANA.has(word.at(-2) ?? '')
	);
}

function buildIchidanForms(base: string): string[] {
	const stem = base.slice(0, -1);
	return [
		base,
		`${stem}ます`,
		`${stem}ました`,
		`${stem}ません`,
		`${stem}ませんでした`,
		`${stem}ましょう`,
		`${stem}ない`,
		`${stem}なかった`,
		`${stem}なくて`,
		`${stem}て`,
		`${stem}た`,
		`${stem}ている`,
		`${stem}ていた`,
		`${stem}ています`,
		`${stem}ていました`,
		`${stem}れば`,
		`${stem}られる`,
		`${stem}られた`,
		`${stem}させる`,
		`${stem}させた`,
		`${stem}よう`,
		`${stem}ろ`
	];
}

function buildGodanForms(base: string): string[] {
	const ending = base.at(-1) as keyof typeof GODAN_RULES;
	const rule = GODAN_RULES[ending];
	if (!rule) return [base];
	const stem = base.slice(0, -1);
	const te = base === '行く' ? '行って' : `${stem}${rule.te}`;
	const ta = base === '行く' ? '行った' : `${stem}${rule.ta}`;
	return [
		base,
		`${stem}${rule.i}ます`,
		`${stem}${rule.i}ました`,
		`${stem}${rule.i}ません`,
		`${stem}${rule.i}ませんでした`,
		`${stem}${rule.i}ましょう`,
		`${stem}${rule.a}ない`,
		`${stem}${rule.a}なかった`,
		`${stem}${rule.a}なくて`,
		te,
		ta,
		`${te}いる`,
		`${te}いた`,
		`${te}います`,
		`${te}いました`,
		`${stem}${rule.e}ば`,
		`${stem}${rule.e}る`,
		`${stem}${rule.a}れる`,
		`${stem}${rule.a}せる`,
		`${stem}${rule.o}う`,
		`${stem}${rule.e}`
	];
}

function buildSuruForms(base: string): string[] {
	const stem = base.slice(0, -2);
	return [
		base,
		`${stem}します`,
		`${stem}しました`,
		`${stem}しません`,
		`${stem}しませんでした`,
		`${stem}しましょう`,
		`${stem}しない`,
		`${stem}しなかった`,
		`${stem}して`,
		`${stem}した`,
		`${stem}している`,
		`${stem}していた`,
		`${stem}しています`,
		`${stem}していました`,
		`${stem}すれば`,
		`${stem}される`,
		`${stem}させる`,
		`${stem}しよう`,
		`${stem}しろ`,
		`${stem}できる`,
		`${stem}できた`
	];
}

function buildKuruForms(base: string): string[] {
	const usesKanji = base.endsWith('来る');
	const stem = base.slice(0, -2);
	const prefix = usesKanji ? `${stem}来` : stem;
	return [
		base,
		`${prefix}ます`,
		`${prefix}ました`,
		`${prefix}ません`,
		`${prefix}ませんでした`,
		`${prefix}ましょう`,
		`${stem}こない`,
		`${stem}こなかった`,
		`${prefix}て`,
		`${prefix}た`,
		`${stem}くれば`,
		`${stem}こられる`,
		`${stem}こさせる`,
		`${stem}こよう`,
		`${stem}こい`
	];
}

export function buildVerbForms(base: string): string[] {
	if (base.endsWith('する')) return unique(buildSuruForms(base));
	if (base.endsWith('くる') || base.endsWith('来る')) return unique(buildKuruForms(base));
	if (base.endsWith('る') && isLikelyIchidanVerb(base)) {
		return unique(buildIchidanForms(base));
	}
	return unique(buildGodanForms(base));
}

export function buildAdjectiveForms(base: string): string[] {
	if (!base.endsWith('い') || base.length < 2) return [base];
	const stem = base.slice(0, -1);
	return unique([
		base,
		`${stem}く`,
		`${stem}くない`,
		`${stem}くなかった`,
		`${stem}かった`,
		`${stem}くて`,
		`${stem}ければ`,
		`${stem}そう`,
		`${stem}すぎる`
	]);
}

export function buildHighlightForms(base: string): string[] {
	const forms = [base];
	if (base.endsWith('する') || base.endsWith('くる') || base.endsWith('来る')) {
		forms.push(...buildVerbForms(base));
	} else if (base.endsWith('い') && base.length > 1) {
		forms.push(...buildAdjectiveForms(base));
	} else if (Object.hasOwn(GODAN_RULES, base.at(-1) ?? '')) {
		forms.push(...buildVerbForms(base));
	}
	return unique(forms).sort((left, right) => right.length - left.length);
}
