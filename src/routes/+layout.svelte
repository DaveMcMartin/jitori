<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Jitori - Japanese Sentence Bank</title>
	<meta
		name="description"
		content="Search Japanese sentence examples with conjugation-aware lookup, audio playback, and Anki export."
	/>
</svelte:head>

<div class="app">
	{@render children()}
</div>

<style>
	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
		background: #0f172a;
		color: #f3f4f6;
		overflow: hidden;
	}

	.app {
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}
</style>
