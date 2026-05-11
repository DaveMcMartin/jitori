<script lang="ts">
	import { onMount } from 'svelte';
	import { Settings, Database, Check, AlertCircle, RefreshCw, Save, Info } from 'lucide-svelte';
	import { configStore, defaultConfig } from '$lib/stores/config';
	import { ankiService } from '$lib/services/anki';
	import { saveToStorage, loadFromStorage } from '$lib/services/crypto';
	import type { AppConfig } from '$lib/types';

	let decks: string[] = $state([]);
	let noteTypes: string[] = $state([]);
	let noteFields: string[] = $state([]);
	let isAnkiConnected = $state(false);
	let isSaving = $state(false);
	let isRefreshing = $state(false);
	let isHydrated = $state(false);
	let saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (!isHydrated) {
			return;
		}

		if (saveTimeoutId) {
			clearTimeout(saveTimeoutId);
		}

		saveTimeoutId = setTimeout(() => {
			saveToStorage($configStore);
		}, 250);
	});

	onMount(() => {
		(async () => {
			const saved = loadFromStorage<any>();
			const mergedConfig: AppConfig = JSON.parse(JSON.stringify(defaultConfig));

			if (saved?.anki) {
				Object.assign(mergedConfig.anki, saved.anki);
			}

			configStore.set(mergedConfig);
			ankiService.setUrl(mergedConfig.anki.url);
			await checkAnkiConnection();
			isHydrated = true;
		})();

		return () => {
			if (saveTimeoutId) {
				clearTimeout(saveTimeoutId);
			}
		};
	});

	async function checkAnkiConnection() {
		isRefreshing = true;
		ankiService.setUrl($configStore.anki.url);
		isAnkiConnected = await ankiService.checkConnection();

		if (isAnkiConnected) {
			await loadAnkiData();
		} else {
			decks = [];
			noteTypes = [];
			noteFields = [];
		}

		isRefreshing = false;
	}

	async function loadAnkiData() {
		try {
			decks = await ankiService.getDecks();
			noteTypes = await ankiService.getNoteTypes();
			if ($configStore.anki.noteType) {
				noteFields = await ankiService.getNoteFields($configStore.anki.noteType);
			}
		} catch {
			decks = [];
			noteTypes = [];
			noteFields = [];
		}
	}

	async function handleNoteTypeChange() {
		if (!$configStore.anki.noteType) {
			noteFields = [];
			return;
		}
		noteFields = await ankiService.getNoteFields($configStore.anki.noteType);
	}

	function saveConfig() {
		isSaving = true;
		saveToStorage($configStore);
		setTimeout(() => {
			isSaving = false;
		}, 350);
	}
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<Settings size={20} />
		<h2>Anki Setup</h2>
	</div>

	<div class="status-row">
		<div class="status">
			<Database size={16} />
			<span>Connection</span>
			{#if isAnkiConnected}
				<Check size={14} class="success" />
				<strong>Connected</strong>
			{:else}
				<AlertCircle size={14} class="error" />
				<strong>Offline</strong>
			{/if}
		</div>
		<button type="button" class="refresh-btn" onclick={checkAnkiConnection} disabled={isRefreshing}>
			<RefreshCw size={14} class={isRefreshing ? 'spin' : ''} />
			Refresh
		</button>
	</div>

	{#if !isAnkiConnected && isHydrated}
		<div class="anki-info">
			<Info size={14} />
			<p>
				If you're having trouble connecting, ensure <strong><a href="https://ankiweb.net/shared/info/2055492159" target="_blank" rel="noreferrer">Anki Connect</a></strong> is running and 
				<code>https://jitori.davidmartins.net</code> is in the <code>webBindAddress</code> or 
				<code>webCorsOriginList</code> in Anki settings.
			</p>
		</div>
	{/if}

	<div class="content">
		<div class="field">
			<label for="anki-url">AnkiConnect URL</label>
			<input id="anki-url" type="text" bind:value={$configStore.anki.url} onchange={checkAnkiConnection} />
		</div>

		<div class="field">
			<label for="anki-deck">Deck</label>
			<select id="anki-deck" bind:value={$configStore.anki.deckName} disabled={!isAnkiConnected}>
				<option value="">Select a deck</option>
				{#each decks as deck}
					<option value={deck}>{deck}</option>
				{/each}
			</select>
		</div>

		<div class="field">
			<label for="anki-note-type">Note Type</label>
			<select
				id="anki-note-type"
				bind:value={$configStore.anki.noteType}
				onchange={handleNoteTypeChange}
				disabled={!isAnkiConnected}
			>
				<option value="">Select a note type</option>
				{#each noteTypes as noteType}
					<option value={noteType}>{noteType}</option>
				{/each}
			</select>
		</div>

		{#if noteFields.length > 0}
			<div class="mapping">
				<h3>Field Mapping</h3>

				<div class="anki-info mapping-info">
					<Info size={14} class="info-icon" />
					<p>
						Not sure how to set up Anki or what card template to use? Check out this
						<strong><a href="https://tatsumoto.neocities.org/blog/setting-up-anki" target="_blank" rel="noreferrer">setup guide</a></strong>
						and this <strong><a href="https://ankiweb.net/shared/info/1557722832" target="_blank" rel="noreferrer">recommended card template</a></strong>.
					</p>
				</div>

				<div class="field">
					<label for="field-sentence">Sentence</label>
					<select id="field-sentence" bind:value={$configStore.anki.fields.sentence}>
						<option value="">-- None --</option>
						{#each noteFields as field}
							<option value={field}>{field}</option>
						{/each}
					</select>
				</div>

				<div class="field">
					<label for="field-translation">Translation</label>
					<select id="field-translation" bind:value={$configStore.anki.fields.translation}>
						<option value="">-- None --</option>
						{#each noteFields as field}
							<option value={field}>{field}</option>
						{/each}
					</select>
				</div>

				<div class="field">
					<label for="field-word">Word</label>
					<select id="field-word" bind:value={$configStore.anki.fields.word}>
						<option value="">-- None --</option>
						{#each noteFields as field}
							<option value={field}>{field}</option>
						{/each}
					</select>
				</div>

				<div class="field">
					<label for="field-word-definition">Word Definition</label>
					<select id="field-word-definition" bind:value={$configStore.anki.fields.wordDefinition}>
						<option value="">-- None --</option>
						{#each noteFields as field}
							<option value={field}>{field}</option>
						{/each}
					</select>
				</div>

				<div class="field">
					<label for="field-audio">Sentence Audio</label>
					<select id="field-audio" bind:value={$configStore.anki.fields.audio}>
						<option value="">-- None --</option>
						{#each noteFields as field}
							<option value={field}>{field}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}
	</div>

	<div class="footer">
		<button type="button" class="save-btn" onclick={saveConfig} disabled={isSaving}>
			<Save size={14} />
			{isSaving ? 'Saving...' : 'Save'}
		</button>
	</div>
</aside>

<style>
	.sidebar {
		width: 320px;
		height: 100%;
		border-left: 1px solid #1f2937;
		background: #0f172a;
		display: flex;
		flex-direction: column;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #1f2937;
	}

	.sidebar-header h2 {
		font-size: 1rem;
	}

	.status-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.25rem;
		border-bottom: 1px solid #1f2937;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.82rem;
		color: #93c5fd;
	}

	.status strong {
		color: #f8fafc;
	}

	.anki-info {
		margin: 1rem 1.25rem 0.5rem;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid #1e293b;
		border-radius: 0.5rem;
		display: flex;
		gap: 0.6rem;
		color: #94a3b8;
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.anki-info a {
		color: #3b82f6;
		text-decoration: underline;
		font-weight: 700;
	}

	.anki-info p strong {
		color: #cbd5e1;
	}

	.anki-info.mapping-info {
		margin: 0 0 1.25rem 0;
		width: 100%;
		box-sizing: border-box;
	}

	:global(.info-icon) {
		min-width: 14px;
	}

	.anki-info code {
		background: #020617;
		padding: 0.1rem 0.25rem;
		border-radius: 0.2rem;
		color: #bfdbfe;
	}

	:global(.success) {
		color: #34d399;
	}

	:global(.error) {
		color: #f87171;
	}

	.refresh-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid #334155;
		background: #111827;
		color: #cbd5e1;
		border-radius: 0.4rem;
		padding: 0.35rem 0.55rem;
		font-size: 0.75rem;
		cursor: pointer;
	}

	:global(.spin) {
		animation: spin 1s linear infinite;
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 1.25rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-bottom: 0.9rem;
	}

	.field label {
		font-size: 0.72rem;
		letter-spacing: 0.02em;
		color: #94a3b8;
		text-transform: uppercase;
	}

	.field input,
	.field select {
		background: #020617;
		border: 1px solid #334155;
		border-radius: 0.45rem;
		padding: 0.5rem 0.6rem;
		color: #f8fafc;
		font-size: 0.86rem;
	}

	.mapping {
		margin-top: 1.2rem;
		padding-top: 1.2rem;
		border-top: 1px solid #1f2937;
	}

	.mapping h3 {
		font-size: 0.76rem;
		color: #cbd5e1;
		text-transform: uppercase;
		margin-bottom: 0.8rem;
	}

	.footer {
		padding: 1rem 1.25rem;
		border-top: 1px solid #1f2937;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.save-btn {
		width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		border: 0;
		background: linear-gradient(135deg, #2563eb, #3b82f6);
		color: white;
		padding: 0.55rem 0.7rem;
		border-radius: 0.45rem;
		cursor: pointer;
		font-weight: 600;
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
