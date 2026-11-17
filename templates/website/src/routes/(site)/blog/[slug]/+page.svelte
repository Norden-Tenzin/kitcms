<script lang="ts">
	import { resolve } from '$app/paths';
	import Img from '#lib/Img.svelte';
	import { asDoc, asMedia } from '#lib/media.ts';
	import RichText from '#lib/RichText.svelte';
	import Seo from '#lib/Seo.svelte';

	let { data } = $props();
	const post = $derived(data.post);
	const cover = $derived(asMedia(post.cover));
	const date = $derived(
		post.publishedAt
			? new Date(post.publishedAt).toLocaleDateString('en', { dateStyle: 'long', timeZone: 'UTC' })
			: '',
	);
</script>

<Seo
	title={post.title}
	description={post.excerpt}
	image={cover}
	siteName={data.site.siteName}
	type="article"
/>

<article class="container wrap">
	<p><a href={resolve('/(site)/blog')} class="back">&larr; Blog</a></p>
	<h1>{post.title}</h1>
	<p class="muted meta">
		{date}
		{#each post.tags ?? [] as tag, i (i)}
			{@const t = asDoc<{ id: string; name: string }>(tag)}
			{#if t}<span class="tag">{t.name}</span>{/if}
		{/each}
	</p>
	{#if cover}<Img
			media={cover}
			ratio={16 / 9}
			widths={[600, 1100, 1600]}
			sizes="(min-width: 68rem) 68rem, 100vw"
			eager
		/>{/if}
	<RichText doc={post.body} />
</article>

<style>
	.wrap {
		padding-block: 2.5rem;
		max-width: 48rem;
	}
	.back {
		color: var(--site-muted);
		text-decoration: none;
	}
	h1 {
		font-size: clamp(2rem, 5vw, 3rem);
	}
	.meta {
		font-size: 0.9rem;
	}
	.tag {
		margin-left: 0.5rem;
		padding: 0.05rem 0.55rem;
		border: 1px solid var(--site-border);
		border-radius: 999px;
	}
	.wrap :global(img) {
		width: 100%;
		object-fit: cover;
		border-radius: var(--site-radius);
		margin-block: 1.5rem;
	}
</style>
