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
		padding-block: var(--section);
	}
	.wrap > :global(.back) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--muted);
		text-decoration: none;
	}
	h1 {
		margin-top: 0.5rem;
		font-size: clamp(2rem, 1.3rem + 3vw, 3rem);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 2rem;
	}
	.badge {
		padding: 0.1em 0.6em;
		border: 1px solid var(--line);
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--fg);
	}
</style>
