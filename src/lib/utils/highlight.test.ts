import { describe, it, expect } from 'vitest';
import { highlightTargetWord } from './highlight';

describe('highlightTargetWord', () => {
	it('should highlight the exact word in the sentence', () => {
		const sentence = 'あいうえお順に並べてください。';
		const targetWord = '順';
		const result = highlightTargetWord(sentence, targetWord);
		expect(result).toBe('あいうえお<span style="color: rgb(0, 170, 0);">順</span>に並べてください。');
	});

	it('should return the original sentence if targetWord is empty', () => {
		const sentence = 'テストです。';
		const result = highlightTargetWord(sentence, '');
		expect(result).toBe('テストです。');
	});

	it('should return the original sentence if targetWord is not found', () => {
		const sentence = 'テストです。';
		const targetWord = '猫';
		const result = highlightTargetWord(sentence, targetWord);
		expect(result).toBe('テストです。');
	});

	it('should highlight multiple occurrences of the target word', () => {
		const sentence = '猫と猫と犬';
		const targetWord = '猫';
		const result = highlightTargetWord(sentence, targetWord);
		expect(result).toBe('<span style="color: rgb(0, 170, 0);">猫</span>と<span style="color: rgb(0, 170, 0);">猫</span>と犬');
	});

	it('should escape special characters in targetWord', () => {
		const sentence = 'これは?と+です。';
		const targetWord = '?';
		const result = highlightTargetWord(sentence, targetWord);
		expect(result).toBe('これは<span style="color: rgb(0, 170, 0);">?</span>と+です。');
	});
});

	it('should highlight a conjugated verb with kanji stem and trailing okurigana', () => {
		const sentence = '昨日、美味しいパンを食べました。';
		const targetWord = '食べる';
		const result = highlightTargetWord(sentence, targetWord);
		expect(result).toBe('昨日、美味しいパンを<span style="color: rgb(0, 170, 0);">食べました</span>。');
	});

	it('should highlight a conjugated i-adjective', () => {
		const sentence = 'その映画はとても面白かった。';
		const targetWord = '面白い';
		const result = highlightTargetWord(sentence, targetWord);
		expect(result).toBe('その映画はとても<span style="color: rgb(0, 170, 0);">面白かった</span>。');
	});

	it('should highlight a conjugated na-adjective or verb if stem kanji is present', () => {
		const sentence = '彼は静かに部屋を出た。';
		const targetWord = '静か';
		const result = highlightTargetWord(sentence, targetWord);
		expect(result).toBe('彼は<span style="color: rgb(0, 170, 0);">静かに</span>部屋を出た。');
	});
