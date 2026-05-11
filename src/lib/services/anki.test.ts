import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ankiService } from './anki';

describe('AnkiService', () => {
	beforeEach(() => {
		global.fetch = vi.fn();
	});

	it('should call canAddNotesWithErrorDetail correctly', async () => {
		const mockResult = [{ canAdd: false, error: 'duplicate' }];
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({ result: mockResult, error: null })
		});

		const config = {
			url: 'http://localhost:8765',
			deckName: 'TestDeck',
			noteType: 'TestModel',
			fields: { sentence: 'Front', translation: 'Back', word: 'Word', wordDefinition: 'Def', audio: 'Audio' }, highlightTargetWord: false
		};

		const note = {
			sentence: 'Hello',
			translation: 'Hola',
			word: 'Hello',
			wordDefinition: 'A greeting',
			audioUrl: 'http://example.com/audio.mp3',
			audioFilename: 'audio.mp3'
		};

		const result = await ankiService.canAddNotesWithErrorDetail(config, note);

		expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
			method: 'POST',
			body: expect.stringContaining('canAddNotesWithErrorDetail')
		}));
		expect(result).toEqual(mockResult);
	});

	it('should call findNotes correctly', async () => {
		const mockResult = [123456789];
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({ result: mockResult, error: null })
		});

		const query = 'deck:"TestDeck" "Word:Hello"';
		const result = await ankiService.findNotes(query);

		expect(result).toEqual(mockResult);
	});
});
