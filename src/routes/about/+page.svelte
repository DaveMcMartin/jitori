<script lang="ts">
	import { ArrowLeft, Info, Database, Layers, ExternalLink } from 'lucide-svelte';
	import GithubIcon from '$lib/components/GithubIcon.svelte';
</script>

<svelte:head>
	<title>About - Jitori</title>
</svelte:head>

<div class="about-page">
	<header class="header">
		<a href="/" class="back-link">
			<ArrowLeft size={18} />
			Back to Search
		</a>
		<h1>About Jitori</h1>
	</header>

	<div class="content">
		<section class="section">
			<div class="section-title">
				<Info size={20} />
				<h2>Project Goal</h2>
			</div>
			<p>
				Jitori was built to help Japanese language learners find real, high-quality example sentences 
				with ease.
			</p>
		</section>

		<section class="section">
			<div class="section-title">
				<Database size={20} />
				<h2>Sentence Source</h2>
			</div>
			<p>
				All 58,000+ sentences in Jitori come from the <strong>Ankidrone Sentence Pack</strong> 
				by <strong>Tatsumoto</strong>.
			</p>
			<a href="https://tatsumoto.neocities.org/blog/ankidrone-sentence-pack" target="_blank" rel="noreferrer" class="source-link">
				<ExternalLink size={16} />
				Visit Ankidrone Sentence Pack
			</a>
		</section>

		<section class="section">
			<div class="section-title">
				<Layers size={20} />
				<h2>Tech Stack</h2>
			</div>
			<ul class="tech-list">
				<li><strong>Frontend:</strong> SvelteKit with Svelte 5</li>
				<li><strong>Database:</strong> Cloudflare D1 (SQLite)</li>
				<li><strong>Storage:</strong> Cloudflare R2 (Audio assets)</li>
				<li><strong>Dictionary Data:</strong> JMdict and Kanjidict via Yomitan</li>
				<li><strong>Infrastructure:</strong> Cloudflare Pages</li>
			</ul>
		</section>

		<section class="section">
			<div class="section-title">
				<GithubIcon size={20} class="section-icon" />
				<h2>Open Source</h2>
			</div>
			<p>
				Jitori is open source and available on GitHub. Contributions, bug reports, and suggestions 
				are welcome!
			</p>
			<a href="https://github.com/DaveMcMartin/jitori" target="_blank" rel="noreferrer" class="github-btn">
				<GithubIcon size={18} />
				View on GitHub
			</a>
		</section>
	</div>
</div>

<style>
	.about-page {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		height: 100vh;
		overflow-y: auto;
		background: #020617;
		color: #f8fafc;
	}

	.header {
		margin-bottom: 3rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: #94a3b8;
		text-decoration: none;
		font-size: 0.9rem;
		margin-bottom: 1rem;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: #3b82f6;
	}

	.header h1 {
		font-size: 2.5rem;
		font-weight: 800;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 3rem;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
		color: #3b82f6;
	}

	.section-title h2 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #f8fafc;
	}

	.section p {
		color: #cbd5e1;
		line-height: 1.7;
		font-size: 1.1rem;
	}

	.source-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		color: #3b82f6;
		text-decoration: none;
		font-weight: 600;
	}

	.source-link:hover {
		text-decoration: underline;
	}

	.tech-list {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.tech-list li {
		background: #0f172a;
		padding: 1rem;
		border-radius: 0.75rem;
		border: 1px solid #1e293b;
		font-size: 0.95rem;
		color: #cbd5e1;
	}

	.tech-list li strong {
		color: #f8fafc;
		display: block;
		margin-bottom: 0.25rem;
		color: #3b82f6;
	}

	.github-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		background: #f8fafc;
		color: #020617;
		padding: 0.75rem 1.5rem;
		border-radius: 0.75rem;
		text-decoration: none;
		font-weight: 700;
		margin-top: 1.5rem;
		transition: transform 0.2s, background-color 0.2s;
	}

	.github-btn:hover {
		background: #e2e8f0;
		transform: translateY(-2px);
	}
</style>
