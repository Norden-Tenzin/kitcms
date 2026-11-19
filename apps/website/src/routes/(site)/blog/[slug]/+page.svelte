<script lang="ts">
	import { formatDate } from '#lib/format.ts';
	import Link from '#lib/Link.svelte';
	import RichText from '#lib/RichText.svelte';
	import Seo from '#lib/Seo.svelte';

	let { data } = $props();
	const post = $derived(data.post);
</script>

<Seo doc={post} siteName={data.site.siteName} description={post.excerpt ?? data.site.tagline} />

<article class="container wrap">
	<Link href="/blog" class="back">&larr; Changelog</Link>
	<h1>{post.title}</h1>
	<p class="meta muted">
		<time datetime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt, 'long')}</time>
		{#if post.kind === 'release' && post.version}<span class="badge">v{post.version}</span>{/if}
	</p>
	<RichText doc={post.body} />
</article>

<style>
	.wrap {
		padding-block: clamp(2rem, 1rem + 3vw, 4rem) var(--section);
	}
	.wrap > :global(.back) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--muted);
		font-weight: 550;
		text-decoration: none;
	}
	.wrap > :global(.back:hover) {
		color: var(--fg);
	}
	h1 {
		max-width: 20ch;
		margin: 1rem 0 1.25rem;
		font-size: clamp(2.25rem, 1.2rem + 4.8vw, 4.75rem);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: clamp(2rem, 1rem + 3vw, 3.5rem);
	}
	.badge {
		padding: 0.1em 0.7em;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 600;
	}
	article :global(.prose) {
		font-size: clamp(1.0625rem, 1rem + 0.3vw, 1.1875rem);
	}
</style>
