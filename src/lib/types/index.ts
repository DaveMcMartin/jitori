export interface WordDefinition {
	word: string;
	reading?: string;
	meaning: string;
	partOfSpeech?: string;
}

export interface AnkiConfig {
	url: string;
	deckName: string;
	noteType: string;
	fields: {
		sentence: string;
		translation: string;
		word: string;
		wordDefinition: string;
		audio: string;
	};
}

export interface AnkiNoteInput {
	sentence: string;
	translation: string;
	word: string;
	wordDefinition: string;
	audioUrl?: string;
	audioFilename?: string;
}

export interface StoredSentence {
	id: string;
	source: string;
	audioPath: string;
	audioUrl: string;
	sentence: string;
	translation: string;
	word: string;
	wordDefinition: string;
	createdAt: string;
}

export interface DictionaryEntry {
	entSeq: number;
	primaryKanji: string;
	primaryReading: string;
	gloss: string;
	partsOfSpeech: string[];
}

export interface KanjiEntry {
	literal: string;
	grade: number | null;
	jlpt: number | null;
	strokeCount: number | null;
	frequency: number | null;
	onReadings: string[];
	kunReadings: string[];
	nanori: string[];
	meanings: string[];
}

export interface AppConfig {
	anki: AnkiConfig;
}

export interface Selection {
	x: number;
	y: number;
	width: number;
	height: number;
}
