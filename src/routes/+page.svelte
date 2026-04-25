<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Search, Play, Pause, Download, ExternalLink, Loader2, BookText, X } from 'lucide-svelte';
	import DictionarySidebar from '$lib/components/DictionarySidebar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { sentenceSearchService, type SentenceSearchExpansion } from '$lib/services/sentence-search';
	import { dictionaryService } from '$lib/services/dictionary';
	import { ankiService } from '$lib/services/anki';
	import { configStore } from '$lib/stores/config';
	import type { AnkiNoteInput, KanjiEntry, StoredSentence } from '$lib/types';

	let query = $state('');
	let expansion = $state<SentenceSearchExpansion | null>(null);
	let results = $state<StoredSentence[]>([]);
	let isSearching = $state(false);
	let isExporting = $state<string | null>(null);
	let statusMessage = $state('');
	let errorMessage = $state('');
	let activeAudioId = $state<string | null>(null);
	let audioPlayer: HTMLAudioElement | null = null;
	let selectedKanji = $state<KanjiEntry | null>(null);
	let isLoadingKanji = $state(false);
	let kanjiError = $state('');

	function clearMessages() {
		statusMessage = '';
		errorMessage = '';
	}

	function resolveAudioUrl(sentence: StoredSentence): string {
		return sentence.audioUrl || sentence.audioPath;
	}

	function stopAudio() {
		if (!audioPlayer) {
			activeAudioId = null;
			return;
		}
		audioPlayer.pause();
		audioPlayer.currentTime = 0;
		audioPlayer = null;
		activeAudioId = null;
	}

	function isKanjiCharacter(character: string): boolean {
		return /[\u3400-\u9fff]/u.test(character);
	}

	function splitSentenceCharacters(sentence: string): string[] {
		return Array.from(sentence);
	}

	async function openKanjiPopup(literal: string) {
		kanjiError = '';
		selectedKanji = null;
		isLoadingKanji = true;
		try {
			selectedKanji = await dictionaryService.getKanji(literal);
		} catch (error) {
			kanjiError = error instanceof Error ? error.message : 'Kanji lookup failed.';
		} finally {
			isLoadingKanji = false;
		}
	}

	function closeKanjiPopup() {
		selectedKanji = null;
		kanjiError = '';
	}

	async function handlePlay(sentence: StoredSentence) {
		const audioUrl = resolveAudioUrl(sentence);
		if (!audioUrl) {
			errorMessage = 'This sentence has no audio file.';
			return;
		}

		if (activeAudioId === sentence.id) {
			stopAudio();
			return;
		}

		stopAudio();
		clearMessages();

		audioPlayer = new Audio(audioUrl);
		activeAudioId = sentence.id;
		audioPlayer.onended = () => {
			activeAudioId = null;
			audioPlayer = null;
		};
		audioPlayer.onerror = () => {
			errorMessage = 'Failed to play audio.';
			activeAudioId = null;
			audioPlayer = null;
		};

		try {
			await audioPlayer.play();
		} catch {
			errorMessage = 'Playback was blocked by the browser.';
			stopAudio();
		}
	}

	function buildAnkiInput(sentence: StoredSentence): AnkiNoteInput {
		const detectedWord = expansion?.baseForm || query.trim();
		return {
			sentence: sentence.sentence,
			translation: sentence.translation,
			word: detectedWord,
			wordDefinition: expansion ? `Part of speech: ${expansion.partOfSpeech}` : '',
			image: ''
		};
	}

	async function exportToAnki(sentence: StoredSentence) {
		clearMessages();
		if (!$configStore.anki.deckName || !$configStore.anki.noteType) {
			errorMessage = 'Set your Anki deck and note type before exporting.';
			return;
		}

		isExporting = sentence.id;
		try {
			ankiService.setUrl($configStore.anki.url);
			await ankiService.openAddCard($configStore.anki, buildAnkiInput(sentence));
			statusMessage = 'Anki Add window opened.';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to open Anki.';
		} finally {
			isExporting = null;
		}
	}

	async function handleSearch() {
		clearMessages();
		const normalized = query.trim();
		if (!normalized) {
			results = [];
			expansion = null;
			errorMessage = 'Type a word to search.';
			return;
		}

		isSearching = true;
		try {
			const response = await sentenceSearchService.searchDetailed(normalized, 80);
			results = response.results;
			expansion = response.expansion;
			if (response.results.length === 0) {
				statusMessage = 'No matching sentences found.';
			}
		} catch (error) {
			results = [];
			expansion = null;
			errorMessage = error instanceof Error ? error.message : 'Search failed.';
		} finally {
			isSearching = false;
		}
	}

	onDestroy(() => {
		stopAudio();
	});
</script>

<div class="layout">
	<DictionarySidebar onKanjiSelect={openKanjiPopup} />
	<main class="main">
		<header class="hero">
			<div>
				<h1>Jitori Sentence Bank</h1>
				<p>Find real Japanese example sentences fast, with audio and one-click Anki export.</p>
			</div>
		</header>

		<form class="search-bar" onsubmit={(event) => { event.preventDefault(); handleSearch(); }}>
			<div class="input-shell">
				<Search size={18} />
				<input
					type="text"
					bind:value={query}
					placeholder="Type a Japanese word (e.g. 食べる, きれい, 勉強)"
					autocomplete="off"
				/>
			</div>
			<button type="submit" class="search-btn" disabled={isSearching}>
				{#if isSearching}
					<Loader2 size={16} class="spinner" />
					Searching
				{:else}
					Search
				{/if}
			</button>
		</form>

		{#if expansion?.terms?.length}
			<section class="expansion">
				<div class="expansion-title">
					<BookText size={14} />
					<span>
						Detected <strong>{expansion.partOfSpeech}</strong>
						{#if expansion.baseForm}
							· base form <strong>{expansion.baseForm}</strong>
						{/if}
					</span>
				</div>
				<div class="chips">
					{#each expansion.terms.slice(0, 16) as term}
						<span class="chip">{term}</span>
					{/each}
				</div>
			</section>
		{/if}

		{#if statusMessage}
			<p class="status">{statusMessage}</p>
		{/if}
		{#if errorMessage}
			<p class="error">{errorMessage}</p>
		{/if}

		<section class="results">
			{#if results.length === 0 && !isSearching}
				<div class="empty">
					<Search size={22} />
					<p>Search to see your sentence list here.</p>
				</div>
			{:else}
				{#each results as sentence}
					<article class="sentence-card">
						<div class="sentence-main">
							<p class="jp">
								{#each splitSentenceCharacters(sentence.sentence) as character}
									{#if isKanjiCharacter(character)}
										<button type="button" class="kanji-inline" onclick={() => openKanjiPopup(character)}>
											{character}
										</button>
									{:else}
										<span>{character}</span>
									{/if}
								{/each}
							</p>
							<p class="translation">{sentence.translation}</p>
						</div>
						<div class="actions">
							<button type="button" class="action-btn" onclick={() => handlePlay(sentence)}>
								{#if activeAudioId === sentence.id}
									<Pause size={14} />
									Pause
								{:else}
									<Play size={14} />
									Play audio
								{/if}
							</button>
							<a class="action-btn" href={resolveAudioUrl(sentence)} download target="_blank" rel="noreferrer">
								<Download size={14} />
								Download audio
							</a>
							<button type="button" class="action-btn primary" onclick={() => exportToAnki(sentence)} disabled={isExporting === sentence.id}>
								{#if isExporting === sentence.id}
									<Loader2 size={14} class="spinner" />
									Exporting
								{:else}
									<ExternalLink size={14} />
									Export to Anki
								{/if}
							</button>
						</div>
					</article>
				{/each}
			{/if}
		</section>
	</main>
	<Sidebar />
</div>

{#if isLoadingKanji || selectedKanji || kanjiError}
	<div class="kanji-overlay">
		<button type="button" class="kanji-backdrop" aria-label="Close kanji details" onclick={closeKanjiPopup}></button>
		<div class="kanji-popup">
			<div class="kanji-popup-header">
				<h3>Kanji details</h3>
				<button type="button" class="close-btn" onclick={closeKanjiPopup}>
					<X size={16} />
				</button>
			</div>
			{#if isLoadingKanji}
				<p class="popup-loading">
					<Loader2 size={14} class="spinner" />
					Loading kanji entry...
				</p>
			{:else if kanjiError}
				<p class="popup-error">{kanjiError}</p>
			{:else if selectedKanji}
				<div class="kanji-content">
					<div class="kanji-literal">{selectedKanji.literal}</div>
					<div class="kanji-meta">
						<span>Strokes: {selectedKanji.strokeCount ?? 'n/a'}</span>
						<span>JLPT: {selectedKanji.jlpt ?? 'n/a'}</span>
						<span>Grade: {selectedKanji.grade ?? 'n/a'}</span>
						<span>Frequency: {selectedKanji.frequency ?? 'n/a'}</span>
					</div>
					<div class="kanji-section">
						<h4>Meanings</h4>
						<p>{selectedKanji.meanings.join(' · ') || 'n/a'}</p>
					</div>
					<div class="kanji-section">
						<h4>On readings</h4>
						<p>{selectedKanji.onReadings.join(' · ') || 'n/a'}</p>
					</div>
					<div class="kanji-section">
						<h4>Kun readings</h4>
						<p>{selectedKanji.kunReadings.join(' · ') || 'n/a'}</p>
					</div>
					<div class="kanji-section">
						<h4>Nanori</h4>
						<p>{selectedKanji.nanori.join(' · ') || 'n/a'}</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.layout {
		display: grid;
		grid-template-columns: 300px 1fr 320px;
		height: 100vh;
	}

	.main {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 2rem;
		gap: 1rem;
		overflow: hidden;
		background:
			radial-gradient(circle at top right, rgba(37, 99, 235, 0.15), transparent 45%),
			#020617;
	}

	.hero h1 {
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: -0.01em;
	}

	.hero p {
		margin-top: 0.35rem;
		color: #94a3b8;
		font-size: 0.98rem;
	}

	.search-bar {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.75rem;
	}

	.input-shell {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.75rem 0.9rem;
		border-radius: 0.7rem;
		border: 1px solid #1e293b;
		background: #0f172a;
		color: #cbd5e1;
	}

	.input-shell input {
		width: 100%;
		border: 0;
		outline: 0;
		background: transparent;
		color: #f8fafc;
		font-size: 1rem;
	}

	.search-btn {
		border: 0;
		border-radius: 0.7rem;
		padding: 0.75rem 1rem;
		font-size: 0.92rem;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		background: linear-gradient(135deg, #2563eb, #3b82f6);
		color: white;
	}

	.expansion {
		border: 1px solid #1e293b;
		border-radius: 0.75rem;
		background: rgba(15, 23, 42, 0.8);
		padding: 0.75rem;
	}

	.expansion-title {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.83rem;
		color: #93c5fd;
	}

	.chips {
		margin-top: 0.6rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.chip {
		border: 1px solid #334155;
		background: #0f172a;
		color: #e2e8f0;
		border-radius: 999px;
		padding: 0.18rem 0.55rem;
		font-size: 0.75rem;
	}

	.status,
	.error {
		font-size: 0.85rem;
	}

	.status {
		color: #22c55e;
	}

	.error {
		color: #f87171;
	}

	.results {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-right: 0.2rem;
	}

	.empty {
		margin-top: 2rem;
		border: 1px dashed #334155;
		border-radius: 0.8rem;
		padding: 1.5rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: #94a3b8;
	}

	.sentence-card {
		border: 1px solid #1e293b;
		border-radius: 0.9rem;
		padding: 1rem;
		background: linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.9));
	}

	.sentence-main {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.jp {
		font-size: 1.35rem;
		line-height: 1.5;
		letter-spacing: 0.01em;
		display: flex;
		flex-wrap: wrap;
		gap: 0.04rem;
	}

	.kanji-inline {
		border: 0;
		background: transparent;
		color: #bfdbfe;
		font-size: 1.35rem;
		line-height: 1.45;
		cursor: pointer;
		border-bottom: 1px dashed rgba(147, 197, 253, 0.45);
		padding: 0 0.05rem;
	}

	.kanji-inline:hover {
		color: #dbeafe;
		border-bottom-color: #93c5fd;
	}

	.translation {
		color: #94a3b8;
		line-height: 1.55;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 0.85rem;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid #334155;
		background: #0f172a;
		color: #e2e8f0;
		padding: 0.43rem 0.65rem;
		font-size: 0.78rem;
		border-radius: 0.5rem;
		text-decoration: none;
		cursor: pointer;
	}

	.action-btn.primary {
		border-color: #2563eb;
		background: rgba(37, 99, 235, 0.18);
		color: #bfdbfe;
	}

	:global(.spinner) {
		animation: spin 1s linear infinite;
	}

	.kanji-overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		z-index: 60;
		padding: 1rem;
	}

	.kanji-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: rgba(2, 6, 23, 0.72);
	}

	.kanji-popup {
		position: relative;
		width: min(460px, 100%);
		border: 1px solid #334155;
		border-radius: 0.9rem;
		background: #020617;
		padding: 0.9rem 1rem 1rem;
		z-index: 1;
	}

	.kanji-popup-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.8rem;
	}

	.kanji-popup-header h3 {
		font-size: 1rem;
	}

	.close-btn {
		border: 1px solid #334155;
		background: #0f172a;
		color: #e2e8f0;
		border-radius: 0.5rem;
		width: 1.8rem;
		height: 1.8rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.popup-loading,
	.popup-error {
		font-size: 0.85rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.popup-error {
		color: #f87171;
	}

	.kanji-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.kanji-literal {
		font-size: 3rem;
		line-height: 1;
		color: #dbeafe;
	}

	.kanji-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: #93c5fd;
	}

	.kanji-meta span {
		border: 1px solid #334155;
		border-radius: 999px;
		padding: 0.2rem 0.5rem;
		background: #0f172a;
	}

	.kanji-section h4 {
		font-size: 0.74rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.kanji-section p {
		margin-top: 0.25rem;
		font-size: 0.88rem;
		line-height: 1.45;
		color: #e2e8f0;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
