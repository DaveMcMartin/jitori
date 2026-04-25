<script lang="ts">
	import { Search, Loader2, Languages, BookText } from 'lucide-svelte';
	import { dictionaryService } from '$lib/services/dictionary';
	import type { DictionaryEntry, KanjiEntry } from '$lib/types';

	let { onKanjiSelect } = $props<{ onKanjiSelect: (literal: string) => void }>();

	let query = $state('');
	let entries = $state<DictionaryEntry[]>([]);
	let kanji = $state<KanjiEntry[]>([]);
	let isSearching = $state(false);
	let errorMessage = $state('');
	let statusMessage = $state('');

	async function searchDictionary() {
		errorMessage = '';
		statusMessage = '';
		const normalized = query.trim();
		if (!normalized) {
			entries = [];
			kanji = [];
			statusMessage = 'Type a word or kanji to search.';
			return;
		}
		isSearching = true;
		try {
			const result = await dictionaryService.search(normalized, 25);
			entries = result.entries;
			kanji = result.kanji;
			if (entries.length === 0 && kanji.length === 0) {
				statusMessage = 'No dictionary matches found.';
			}
		} catch (error) {
			entries = [];
			kanji = [];
			errorMessage = error instanceof Error ? error.message : 'Dictionary search failed.';
		} finally {
			isSearching = false;
		}
	}
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<Languages size={20} />
		<h2>Dictionary</h2>
	</div>

	<form class="search-form" onsubmit={(event) => { event.preventDefault(); searchDictionary(); }}>
		<div class="input-shell">
			<Search size={14} />
			<input type="text" bind:value={query} placeholder="Search JMdict / KANJIDICT" autocomplete="off" />
		</div>
		<button type="submit" class="search-btn" disabled={isSearching}>
			{#if isSearching}
				<Loader2 size={14} class="spin" />
				Searching
			{:else}
				Search
			{/if}
		</button>
	</form>

	{#if statusMessage}
		<p class="status">{statusMessage}</p>
	{/if}
	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	<div class="content">
		{#if kanji.length > 0}
			<section class="panel">
				<h3>Kanji in query</h3>
				<div class="kanji-grid">
					{#each kanji as item}
						<button type="button" class="kanji-chip" onclick={() => onKanjiSelect(item.literal)}>
							<span class="literal">{item.literal}</span>
							<span class="meaning">{item.meanings[0] ?? 'No meaning'}</span>
						</button>
					{/each}
				</div>
			</section>
		{/if}

		{#if entries.length > 0}
			<section class="panel">
				<h3>Word entries</h3>
				<div class="entries">
					{#each entries as entry}
						<article class="entry">
							<div class="head">
								<p class="kanji">{entry.primaryKanji}</p>
								<p class="reading">{entry.primaryReading}</p>
							</div>
							<p class="gloss">{entry.gloss}</p>
							<div class="tags">
								<BookText size={12} />
								<span>{entry.partsOfSpeech.join(' · ') || 'Unknown'}</span>
							</div>
						</article>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		width: 300px;
		height: 100%;
		border-right: 1px solid #1f2937;
		background: #0b1220;
		display: flex;
		flex-direction: column;
		padding-bottom: 0.5rem;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.15rem 0.8rem;
		border-bottom: 1px solid #1f2937;
	}

	.sidebar-header h2 {
		font-size: 1rem;
	}

	.search-form {
		padding: 0.8rem 1rem;
		display: grid;
		gap: 0.5rem;
	}

	.input-shell {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid #334155;
		border-radius: 0.55rem;
		padding: 0.5rem 0.65rem;
		background: #020617;
		color: #cbd5e1;
	}

	.input-shell input {
		width: 100%;
		border: 0;
		outline: 0;
		background: transparent;
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.search-btn {
		border: 0;
		border-radius: 0.55rem;
		padding: 0.45rem 0.7rem;
		font-size: 0.8rem;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		cursor: pointer;
		background: linear-gradient(135deg, #2563eb, #3b82f6);
		color: white;
	}

	.status,
	.error {
		font-size: 0.76rem;
		padding: 0 1rem;
	}

	.status {
		color: #34d399;
	}

	.error {
		color: #f87171;
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 0.4rem 1rem 0;
	}

	.panel + .panel {
		margin-top: 1rem;
	}

	.panel h3 {
		font-size: 0.74rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #94a3b8;
		margin-bottom: 0.45rem;
	}

	.kanji-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.35rem;
	}

	.kanji-chip {
		border: 1px solid #334155;
		background: #111827;
		color: #e2e8f0;
		border-radius: 0.55rem;
		padding: 0.45rem 0.55rem;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.5rem;
		align-items: center;
		cursor: pointer;
		text-align: left;
	}

	.literal {
		font-size: 1.2rem;
		line-height: 1;
		color: #bfdbfe;
	}

	.meaning {
		font-size: 0.72rem;
		color: #cbd5e1;
	}

	.entries {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.entry {
		border: 1px solid #1f2937;
		border-radius: 0.65rem;
		padding: 0.55rem 0.6rem;
		background: #0f172a;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
	}

	.kanji {
		font-size: 1rem;
		color: #f8fafc;
	}

	.reading {
		font-size: 0.75rem;
		color: #93c5fd;
	}

	.gloss {
		margin-top: 0.35rem;
		font-size: 0.76rem;
		color: #cbd5e1;
		line-height: 1.45;
	}

	.tags {
		margin-top: 0.35rem;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.68rem;
		color: #94a3b8;
	}

	:global(.spin) {
		animation: spin 1s linear infinite;
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
