export function highlightTargetWord(sentence: string, targetWord: string): string {
	if (!targetWord) return sentence;

	const escapedWord = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	let regex = new RegExp(`(${escapedWord})`, 'g');

	const isPureKana = /^[ぁ-んァ-ヶー]+$/.test(targetWord);

	if (regex.test(sentence)) {
		if (!isPureKana) {
			const kanjiStemMatch = targetWord.match(/^([一-龯]+[ぁ-ん]+)/);
			if (kanjiStemMatch) {
				const stemRegex = new RegExp(`(${escapedWord}[ぁ-ん]+)`, 'g');
				const stemMatch = sentence.match(stemRegex);
				if (stemMatch) {
					const exactConjugatedForm = stemMatch[0];
					const exactEscaped = exactConjugatedForm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					return sentence.replace(new RegExp(`(${exactEscaped})`, 'g'), '<span style="color: rgb(0, 170, 0);">$1</span>');
				}
			}
		}

		return sentence.replace(regex, '<span style="color: rgb(0, 170, 0);">$1</span>');
	}

	const kanjiMatch = targetWord.match(/^([一-龯]+)/);
	if (kanjiMatch) {
		const kanjiStem = kanjiMatch[1];
		if (sentence.includes(kanjiStem)) {
			const stemEscaped = kanjiStem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const stemRegex = new RegExp(`(${stemEscaped}[ぁ-ん]*)`, 'g');

			const stemMatch = sentence.match(stemRegex);
			if (stemMatch) {
				const exactConjugatedForm = stemMatch[0];
				const exactEscaped = exactConjugatedForm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				return sentence.replace(new RegExp(`(${exactEscaped})`, 'g'), '<span style="color: rgb(0, 170, 0);">$1</span>');
			}
		}
	}

	return sentence;
}