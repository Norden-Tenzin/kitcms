<script lang="ts">
	import { resolve } from '$app/paths';
	import { resolveDesign } from '#lib/designs.ts';
	import { formatDate } from '#lib/format.ts';
	import Img from '#lib/Img.svelte';
	import { asDoc, asMedia } from '#lib/media.ts';
	import RichText from '#lib/RichText.svelte';
	import Seo from '#lib/Seo.svelte';

	let { data } = $props();
	const post = $derived(data.post);
	const cover = $derived(asMedia(post.cover));
	const design = $derived(resolveDesign('post', data.site.design, post.design));
	const tags = $derived(
		(post.tags ?? []).flatMap((t) => {
			const d = asDoc<{ id: string; name: string }>(t);
			return d ? [d] : [];
		}),
	);
</script>

<Seo
	title={post.title}
	description={post.excerpt}
	image={cover}
	siteName={data.site.siteName}
	type="article"
/>

<!-- A "Essay": a narrow reading column. B "Feature": the cover as a full-bleed header.
     C "Article": the facts in a sticky column beside the text. -->
<article data-design={design}>
	{#snippet meta()}
		<p class="meta small muted">
			<time datetime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt, 'long')}</time>
			{#each tags as tag (tag.id)}<span class="tag">{tag.name}</span>{/each}
		</p>
	{/snippet}
	{#snippet back()}
		<a href={resolve('/(site)/blog')} class="back">&larr; Blog</a>
	{/snippet}

	{#if design === 'b'}
		<header class="hero" class:photo={cover}>
			{#if cover}
				<div class="bg"><Img media={cover} fill widths={[800, 1400, 2200]} sizes="100vw" eager /></div>
			{/if}
			<div class="container inner">
				{@render back()}
				<h1>{post.title}</h1>
				{@render meta()}
			</div>
		</header>
		<div class="container body"><RichText doc={post.body} /></div>
	{:else if design === 'c'}
		<div class="container c-wrap">
			<aside>
				{@render back()}
				{@render meta()}
			</aside>
			<div class="c-main">
				<h1>{post.title}</h1>
				{#if post.excerpt}<p class="lead muted">{post.excerpt}</p>{/if}
				{#if cover}
					<Img media={cover} ratio={16 / 9} widths={[600, 1000, 1400]} sizes="(min-width: 64rem) 52rem, 100vw" eager />
				{/if}
				<RichText doc={post.body} />
			</div>
		</div>
	{:else}
		<div class="container a-wrap">
			<header>
				{@render back()}
				<h1>{post.title}</h1>
				{@render meta()}
			</header>
			{#if cover}
				<Img media={cover} ratio={16 / 9} widths={[600, 1100, 1600]} sizes="(min-width: 74rem) 70rem, 100vw" eager />
			{/if}
			<RichText doc={post.body} />
		</div>
	{/if}
</article>

<style>
	article {
		padding-bottom: var(--section);
	}
	h1 {
		font-size: clamp(2.1rem, 1.3rem + 3.4vw, 3.75rem);
		margin: var(--s-3) 0 var(--s-2);
	}
	.back {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--muted);
		text-decoration: none;
	}
	.back:hover {
		color: var(--ink);
		text-decoration: underline;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 0.6rem;
		margin: 0;
	}
	article :global(.container img) {
		border-radius: var(--radius);
	}

	/* A: essay */
	article[data-design='a'] {
		--font-display: var(--font-serif);
		padding-top: var(--s-4);
	}
	.a-wrap {
		display: grid;
		gap: var(--s-5);
	}
	.a-wrap header,
	.a-wrap :global(.prose) {
		max-width: var(--measure);
		width: 100%;
		margin-inline: auto;
	}
	.a-wrap :global(.prose) {
		font-family: var(--font-serif);
		font-size: 1.1875rem;
		line-height: 1.7;
	}
	article[data-design='a'] h1 {
		font-weight: 600;
	}

	/* B: feature */
	.hero {
		display: flex;
		align-items: flex-end;
		position: relative;
		min-height: clamp(20rem, 55svh, 34rem);
		padding-block: var(--s-4) var(--s-6);
		background: var(--accent);
		color: var(--accent-ink);
		--focus: var(--accent-ink);
		overflow: hidden;
	}
	.hero .inner {
		position: relative;
		z-index: 1;
	}
	.hero .back,
	.hero .meta {
		color: inherit;
		opacity: 0.92;
	}
	.hero.photo {
		min-height: clamp(26rem, 78svh, 46rem);
		background: #2a2c2e;
		color: #ffffff;
		--focus: #ffffff;
	}
	.hero .bg {
		position: absolute;
		inset: 0;
	}
	.hero.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(0 0 0 / 0.78), rgb(0 0 0 / 0.12) 70%); /* taste-skill-ignore: scrim under text on a photograph */
	}
	.hero .tag {
		background: rgb(255 255 255 / 0.2);
		color: inherit;
	}
	.hero h1 {
		max-width: 20ch;
	}
	.body {
		padding-top: var(--s-6);
	}
	.body :global(.prose) {
		margin-inline: auto;
	}
	.body :global(.prose > p:first-child) {
		font-size: var(--step-lead);
	}

	/* C: article */
	.c-wrap {
		display: grid;
		gap: var(--s-3);
		padding-top: var(--s-4);
	}
	aside {
		display: flex;
		flex-direction: column;
	}
	.c-main {
		display: grid;
		gap: var(--s-4);
		align-content: start;
	}
	.c-main h1 {
		margin-top: 0;
		margin-bottom: 0;
	}
	.c-main :global(.lead) {
		margin: 0;
	}
	@media (min-width: 64rem) {
		.c-wrap {
			grid-template-columns: 13rem 1fr;
			gap: var(--s-6);
		}
		aside {
			position: sticky;
			top: calc(var(--header-h) + var(--s-3));
			align-self: start;
		}
		aside .meta {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--s-1);
		}
	}
</style>
