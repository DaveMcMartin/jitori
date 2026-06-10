import { describe, expect, it } from 'vitest';
import { highlightTargetWord } from './highlight';

const open = '<span style="color: rgb(0, 170, 0);">';
const close = '</span>';
const highlighted = (word: string) => `${open}${word}${close}`;

describe('highlightTargetWord', () => {
	it('highlights an exact kanji noun without consuming its particle', () => {
		expect(highlightTargetWord('あいうえお順に並べてください。', '順')).toBe(
			`あいうえお${highlighted('順')}に並べてください。`
		);
	});

	it('highlights an exact kana noun without consuming adjacent kana', () => {
		expect(highlightTargetWord('猫のことを話した。', 'こと')).toBe(`猫の${highlighted('こと')}を話した。`);
	});

	it('returns the original sentence for an empty target', () => {
		expect(highlightTargetWord('テストです。', '')).toBe('テストです。');
	});

	it('returns the original sentence when the target is absent', () => {
		expect(highlightTargetWord('テストです。', '猫')).toBe('テストです。');
	});

	it('highlights every exact occurrence', () => {
		expect(highlightTargetWord('猫と猫と犬', '猫')).toBe(`${highlighted('猫')}と${highlighted('猫')}と犬`);
	});

	it('treats regex metacharacters as ordinary text', () => {
		expect(highlightTargetWord('これは?と+です。', '?')).toBe(`これは${highlighted('?')}と+です。`);
	});

	it('highlights an ichidan polite past form without consuming punctuation', () => {
		expect(highlightTargetWord('昨日、美味しいパンを食べました。', '食べる')).toBe(
			`昨日、美味しいパンを${highlighted('食べました')}。`
		);
	});

	it('highlights an ichidan negative form without consuming the following particle', () => {
		expect(highlightTargetWord('今日は何も食べないでください。', '食べる')).toBe(
			`今日は何も${highlighted('食べない')}でください。`
		);
	});

	it('highlights a godan te form without consuming an auxiliary phrase', () => {
		expect(highlightTargetWord('手紙を書いてください。', '書く')).toBe(
			`手紙を${highlighted('書いて')}ください。`
		);
	});

	it('highlights the full progressive form when it is generated explicitly', () => {
		expect(highlightTargetWord('彼は本を読んでいるところだ。', '読む')).toBe(
			`彼は本を${highlighted('読んでいる')}ところだ。`
		);
	});

	it('highlights the irregular te form of 行く', () => {
		expect(highlightTargetWord('明日学校へ行ってみる。', '行く')).toBe(
			`明日学校へ${highlighted('行って')}みる。`
		);
	});

	it('highlights a conjugated i-adjective without consuming a particle', () => {
		expect(highlightTargetWord('その映画は面白かったけど長い。', '面白い')).toBe(
			`その映画は${highlighted('面白かった')}けど長い。`
		);
	});

	it('highlights an i-adjective adverbial form without consuming the next word', () => {
		expect(highlightTargetWord('値段が高くなった。', '高い')).toBe(`値段が${highlighted('高く')}なった。`);
	});

	it('does not guess that kana after a na-adjective belongs to the target', () => {
		expect(highlightTargetWord('彼は静かに部屋を出た。', '静か')).toBe(`彼は${highlighted('静か')}に部屋を出た。`);
	});

	it('does not consume a particle after a dictionary-form verb', () => {
		expect(highlightTargetWord('魚を食べると元気になる。', '食べる')).toBe(
			`魚を${highlighted('食べる')}と元気になる。`
		);
	});

	it('does not consume an adjacent kana word after an exact noun', () => {
		expect(highlightTargetWord('順番を確認する。', '順')).toBe(`${highlighted('順')}番を確認する。`);
	});

	it('highlights differently conjugated occurrences independently', () => {
		expect(highlightTargetWord('食べる、食べた、食べない。', '食べる')).toBe(
			`${highlighted('食べる')}、${highlighted('食べた')}、${highlighted('食べない')}。`
		);
	});

	it('highlights suru compounds without consuming following kana', () => {
		expect(highlightTargetWord('毎日勉強していますが、昨日は勉強しなかった。', '勉強する')).toBe(
			`毎日${highlighted('勉強しています')}が、昨日は${highlighted('勉強しなかった')}。`
		);
	});

	it('does not highlight unrelated words sharing only the kanji stem', () => {
		expect(highlightTargetWord('食事を準備した。', '食べる')).toBe('食事を準備した。');
	});
});
