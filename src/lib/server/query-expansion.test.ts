import { describe, expect, it } from 'vitest';
import { deriveDeinflections, expandSearchQuery } from './query-expansion';

describe('deriveDeinflections', () => {
	it.each([
		['食べました', '食べる'],
		['食べなかった', '食べる'],
		['書きません', '書く'],
		['飲まなかった', '飲む'],
		['話して', '話す'],
		['読んだ', '読む'],
		['泳いで', '泳ぐ'],
		['行った', '行く'],
		['高かった', '高い'],
		['面白くない', '面白い'],
		['勉強した', '勉強する'],
		['勉強しました', '勉強する'],
		['勉強しなかった', '勉強する']
	])('derives %s back to %s', (inflected, base) => {
		expect(deriveDeinflections(inflected)).toContain(base);
	});
});

describe('expandSearchQuery', () => {
	it.each([
		['食べました', '食べる'],
		['食べなかった', '食べる'],
		['書きません', '書く'],
		['飲まなかった', '飲む'],
		['話して', '話す'],
		['読んだ', '読む'],
		['泳いで', '泳ぐ'],
		['行った', '行く'],
		['勉強した', '勉強する'],
		['勉強しました', '勉強する'],
		['勉強しなかった', '勉強する']
	])('selects %s as an inflection of %s', (query, baseForm) => {
		const expansion = expandSearchQuery(query);
		expect(expansion.partOfSpeech).toBe('verb');
		expect(expansion.baseForm).toBe(baseForm);
		expect(expansion.terms).toContain(query);
		expect(expansion.terms).toContain(baseForm);
	});

	it.each([
		['食べる', ['食べます', '食べませんでした', '食べている', '食べられる', '食べさせる']],
		['書く', ['書きます', '書かない', '書いて', '書いた', '書ける', '書こう']],
		['読む', ['読みます', '読まない', '読んで', '読んだ', '読める', '読もう']],
		['行く', ['行きます', '行かない', '行って', '行った', '行ける', '行こう']],
		['勉強する', ['勉強します', '勉強しない', '勉強している', '勉強される', '勉強できる']]
	])('generates useful search variants for %s', (base, expectedTerms) => {
		const expansion = expandSearchQuery(base);
		expect(expansion.baseForm).toBe(base);
		expect(expansion.terms).toEqual(expect.arrayContaining(expectedTerms));
	});

	it.each([
		['高い', ['高く', '高くない', '高かった', '高くて', '高ければ']],
		['面白い', ['面白く', '面白くない', '面白かった', '面白くて', '面白ければ']]
	])('generates useful adjective variants for %s', (base, expectedTerms) => {
		const expansion = expandSearchQuery(base);
		expect(expansion.partOfSpeech).toBe('adjective');
		expect(expansion.baseForm).toBe(base);
		expect(expansion.terms).toEqual(expect.arrayContaining(expectedTerms));
	});

	it('does not transform an ordinary noun into unrelated verb forms', () => {
		const expansion = expandSearchQuery('学校');
		expect(expansion.partOfSpeech).toBe('noun');
		expect(expansion.baseForm).toBe('学校');
		expect(expansion.terms).not.toContain('学校る');
	});

	it('does not generate godan false positives for an ichidan verb', () => {
		const expansion = expandSearchQuery('食べる');
		expect(expansion.terms).not.toEqual(expect.arrayContaining(['食ぶ', '食ばない', '食んだ']));
	});

	it('generates godan forms for a common godan ru exception', () => {
		const expansion = expandSearchQuery('帰る');
		expect(expansion.terms).toEqual(expect.arrayContaining(['帰ります', '帰らない', '帰った']));
		expect(expansion.terms).not.toContain('帰ない');
	});
});
