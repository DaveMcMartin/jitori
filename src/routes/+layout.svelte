<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Jitori - Japanese Sentence Bank</title>
	<meta
		name="description"
		content="Search Japanese sentence examples with conjugation-aware lookup, high-quality audio playback, and one-click Anki export."
	/>
	<meta name="keywords" content="japanese, sentences, dictionary, anki, learning, language, audio, immersion" />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://jitori.davidmartins.net/" />
	<meta property="og:title" content="Jitori - Japanese Sentence Bank" />
	<meta property="og:description" content="Search Japanese sentence examples with conjugation-aware lookup and Anki export." />
	<meta property="og:image" content="/screenshot.jpeg" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:title" content="Jitori - Japanese Sentence Bank" />
	<meta property="twitter:description" content="Search Japanese sentence examples with conjugation-aware lookup and Anki export." />
	<meta property="twitter:image" content="/screenshot.jpeg" />

	<link rel="icon" type="image/x-icon" href="/favicon.ico" />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/favicon-256x256.png" />
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
