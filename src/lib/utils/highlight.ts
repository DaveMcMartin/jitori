import { buildHighlightForms } from './japanese-word-forms';

const HIGHLIGHT_OPEN = '<span style="color: rgb(0, 170, 0);">';
const HIGHLIGHT_CLOSE = '</span>';

export function highlightTargetWord(sentence: string, targetWord: string): string {
	if (!targetWord) return sentence;

	const forms = buildHighlightForms(targetWord);
	let result = '';
	let index = 0;

	while (index < sentence.length) {
		const form = forms.find((candidate) => sentence.startsWith(candidate, index));
		if (form) {
			result += `${HIGHLIGHT_OPEN}${form}${HIGHLIGHT_CLOSE}`;
			index += form.length;
		} else {
			result += sentence[index];
			index += 1;
		}
	}

	return result;
}
