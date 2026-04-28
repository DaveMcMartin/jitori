<script lang="ts">
	import { Loader2, Languages, BookText, Ghost, SearchX } from 'lucide-svelte';
	import { dictionaryService } from '$lib/services/dictionary';
	import type { DictionaryEntry, KanjiEntry } from '$lib/types';

	let { onKanjiSelect, query = '' } = $props<{
		onKanjiSelect: (literal: string) => void;
		query?: string;
	}>();

	let entries = $state<DictionaryEntry[]>([]);
	let kanji = $state<KanjiEntry[]>([]);
	let isSearching = $state(false);
	let errorMessage = $state('');
	let contentElement = $state<HTMLElement | null>(null);

	async function searchDictionary(searchTerm: string) {
		errorMessage = '';
		const normalized = searchTerm.trim();
		if (!normalized) {
			entries = [];
			kanji = [];
			return;
		}
		isSearching = true;
		try {
			const result = await dictionaryService.search(normalized, 25);
			entries = result.entries;
			kanji = result.kanji;
			if (contentElement) {
				contentElement.scrollTo({ top: 0, behavior: 'smooth' });
			}
		} catch (error) {
			entries = [];
			kanji = [];
			errorMessage = error instanceof Error ? error.message : 'Dictionary search failed.';
		} finally {
			isSearching = false;
		}
	}

	$effect(() => {
		searchDictionary(query);
	});
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<Languages size={20} />
		<h2>Dictionary</h2>
	</div>

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	<div class="content" bind:this={contentElement}>
		{#if isSearching}
			<div class="empty-state">
				<Loader2 size={32} class="spin" />
				<p>Searching dictionary...</p>
			</div>
		{:else if !query.trim()}
			<div class="empty-state">
				<Ghost size={32} />
				<p>Enter a search term to see dictionary definitions here.</p>
			</div>
		{:else if entries.length === 0 && kanji.length === 0}
			<div class="empty-state">
				<SearchX size={32} />
				<p>No dictionary matches found for "{query}".</p>
			</div>
		{:else}
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
		padding: 1.25rem 1.15rem 1rem;
		border-bottom: 1px solid #1f2937;
	}

	.sidebar-header h2 {
		font-size: 1rem;
		font-weight: 700;
		color: #f8fafc;
	}

	.error {
		font-size: 0.76rem;
		padding: 0.75rem 1rem;
		color: #f87171;
		background: rgba(248, 113, 113, 0.1);
		margin: 0.5rem 1rem;
		border-radius: 0.5rem;
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 60%;
		text-align: center;
		color: #64748b;
		gap: 1rem;
		padding: 2rem;
	}

	.empty-state p {
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.panel + .panel {
		margin-top: 1.5rem;
	}

	.panel h3 {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
		margin-bottom: 0.75rem;
		font-weight: 700;
	}

	.kanji-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.5rem;
	}

	.kanji-chip {
		border: 1px solid #1e293b;
		background: #0f172a;
		color: #e2e8f0;
		border-radius: 0.75rem;
		padding: 0.6rem 0.75rem;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		align-items: center;
		cursor: pointer;
		text-align: left;
		transition: all 0.2s;
	}

	.kanji-chip:hover {
		border-color: #3b82f6;
		background: #1e293b;
	}

	.literal {
		font-size: 1.5rem;
		line-height: 1;
		color: #3b82f6;
		font-weight: 500;
	}

	.meaning {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.entries {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.entry {
		border: 1px solid #1e293b;
		border-radius: 0.75rem;
		padding: 0.75rem;
		background: #0f172a;
		transition: border-color 0.2s;
	}

	.entry:hover {
		border-color: #334155;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.kanji {
		font-size: 1.125rem;
		color: #f8fafc;
		font-weight: 600;
	}

	.reading {
		font-size: 0.875rem;
		color: #3b82f6;
	}

	.gloss {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #cbd5e1;
		line-height: 1.6;
	}

	.tags {
		margin-top: 0.6rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7rem;
		color: #64748b;
		background: #1e293b;
		padding: 0.2rem 0.5rem;
		border-radius: 0.25rem;
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

