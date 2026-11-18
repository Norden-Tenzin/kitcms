<script lang="ts">
	// One journal post, three compositions. A "Essay": a quiet reading column with the byline and share
	// links in the margin. B "Feature": the cover is the first screen, a wide measure, the next note
	// on a field. C "Letter": a sticky sender column beside the text, a signature at the end.
	// All three: a reading-progress bar, tags that filter the journal, newer/older links.
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import { fmtDate } from '../format';
	import { asMedia } from '../media';
	import type { DesignId } from '../designs';
	import type { Post } from '../types';
	import PostPager from './PostPager.svelte';
	import { authorOf, photoOf, tagsOf } from './postmeta';
	import ReadingProgress from './ReadingProgress.svelte';
	import ShareLinks from './ShareLinks.svelte';

	interface Pager {
		slug: string;
		title: string;
		cover?: unknown;
		publishedAt?: string | null;
	}
	interface Props {
		post: Post;
		newer: Pager | null;
		older: Pager | null;
		related: Post[];
		url: string;
		design?: DesignId;
	}
	let { post, newer, older, related, url, design = 'a' }: Props = $props();
	const cover = $derived(asMedia(post.cover));
	const author = $derived(authorOf(post));
	const photo = $derived(photoOf(author));
	const tags = $derived(tagsOf(post));
	const date = $derived(fmtDate(post.publishedAt));
</script>

<!-- Internal links and anchors are plain paths built here, not routes to resolve. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<ReadingProgress target="post-body" />

{#snippet tagLinks()}
	{#if tags.length}
		<ul class="tags" aria-label="Topics">
			{#each tags as t (t.id)}<li><a href={`/journal?tag=${encodeURIComponent(t.slug)}`}>{t.name}</a></li>{/each}
		</ul>
	{/if}
{/snippet}

{#snippet byline()}
	{#if author}
		<div class="by">
			{#if photo}<span class="face"><Pic media={photo} ratio={1} widths={[120, 240]} sizes="3.5rem" alt="" /></span>{/if}
			<p><strong>{author.name}</strong>{#if author.role}<span class="small">{author.role}</span>{/if}</p>
		</div>
	{/if}
{/snippet}

{#snippet more()}
	{#if related.length}
		<Section>
			<h2 class="h2">More from the journal</h2>
			<ul class="more">
				{#each related as p (p.id)}
					<li>
						<Link href={`/journal/${p.slug}`}>
							<Pic media={asMedia(p.cover)} ratio={3 / 2} sizes="(min-width: 56rem) 28vw, 100vw" />
							<span class="small">{fmtDate(p.publishedAt)}</span>
							<h3>{p.title}</h3>
						</Link>
					</li>
				{/each}
			</ul>
		</Section>
	{/if}
{/snippet}

{#if design === 'b'}
	<article>
		<header class="b-hero on-dark">
			<div class="photo"><Img media={cover} eager fit="cover" widths={[800, 1400, 2000]} sizes="100vw" alt="" /></div>
			<div class="container inner">
				<h1>{post.title}</h1>
				{#if post.excerpt}<p class="lead">{post.excerpt}</p>{/if}
				<p class="small">{[date, author?.name].filter(Boolean).join(', ')}</p>
			</div>
		</header>
		<Section>
			<div class="b-wrap">
				<div id="post-body" class="b-body"><RichText doc={post.body} /></div>
				<div class="b-foot">
					{@render tagLinks()}
					<ShareLinks {url} title={post.title} />
				</div>
			</div>
		</Section>
		{#if older}
			<Section tone="slate" pad="none">
				<div class="b-next">
					<Link href={`/journal/${older.slug}`} class="b-nextlink" rel="prev">
						<span class="small">Older note, {fmtDate(older.publishedAt)}</span>
						<span class="t">{older.title}</span>
					</Link>
					<Pic media={asMedia(older.cover)} ratio={4 / 3} sizes="(min-width: 56rem) 40vw, 100vw" alt="" class="b-nextpic" />
				</div>
			</Section>
		{/if}
		{#if newer}
			<Section pad="top"><PostPager {newer} older={null} /></Section>
		{/if}
		{@render more()}
	</article>
{:else if design === 'c'}
	<article>
		<div class="container c-wrap pt-hdr">
			<aside class="c-side" aria-label="About this note">
				<dl>
					<div><dt class="small">From</dt><dd>{@render byline()}</dd></div>
					<div><dt class="small">Written</dt><dd>{date}</dd></div>
					{#if tags.length}<div><dt class="small">Filed under</dt><dd>{@render tagLinks()}</dd></div>{/if}
				</dl>
				<ShareLinks {url} title={post.title} />
			</aside>
			<div class="c-main">
				<h1>{post.title}</h1>
				{#if post.excerpt}<p class="lead">{post.excerpt}</p>{/if}
				<Pic media={cover} ratio={3 / 2} eager widths={[700, 1200, 1800]} sizes="(min-width: 56rem) 52vw, 100vw" alt="" />
				<div id="post-body"><RichText doc={post.body} /></div>
				{#if author}<p class="sign">{author.name}</p>{/if}
			</div>
		</div>
		<Section pad="top"><PostPager {newer} {older} /></Section>
		{@render more()}
	</article>
{:else}
	<article>
		<header class="container a-head pt-hdr">
			<p class="small">{date}{#if tags.length}, {tags.map((t) => t.name).join(', ')}{/if}</p>
			<h1>{post.title}</h1>
			{#if post.excerpt}<p class="lead">{post.excerpt}</p>{/if}
		</header>
		<div class="container"><Pic media={cover} ratio={16 / 8} eager widths={[800, 1400, 2000]} sizes="(min-width: 82rem) 78rem, 100vw" alt="" /></div>
		<Section>
			<div class="a-cols">
				<aside class="a-side" aria-label="About this note">
					{@render byline()}
					{@render tagLinks()}
					<ShareLinks {url} title={post.title} />
				</aside>
				<div id="post-body" class="a-body"><RichText doc={post.body} /></div>
			</div>
		</Section>
		<Section pad="top"><PostPager {newer} {older} /></Section>
		{@render more()}
	</article>
{/if}

<style>
	ul,
	dl,
	dd {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.h2 {
		margin-bottom: var(--s-6);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-4);
	}
	.tags a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 600;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.25em;
	}
	.by {
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}
	.by p {
		display: grid;
		gap: 0;
	}
	.face {
		width: 3.5rem;
		flex: none;
	}
	.more {
		display: grid;
		gap: var(--s-6);
	}
	.more :global(a) {
		display: grid;
		gap: var(--s-2);
		text-decoration: none;
	}
	.more :global(a:hover h3) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.12em;
	}
	@media (min-width: 56rem) {
		.more {
			grid-template-columns: repeat(3, 1fr);
			gap: var(--s-5);
		}
	}

	/* ----- A: Essay ----- */
	.a-head {
		display: grid;
		gap: var(--s-4);
		padding-bottom: var(--s-6);
		max-width: 62rem;
		margin-inline: auto;
	}
	.a-head h1 {
		font-size: clamp(3rem, 1rem + 8vw, 7.5rem);
	}
	.a-cols {
		display: grid;
		gap: var(--s-6);
	}
	.a-side {
		display: grid;
		gap: var(--s-4);
		align-content: start;
		order: 2;
	}
	.a-body :global(.prose) {
		font-size: clamp(1.125rem, 1.05rem + 0.35vw, 1.3125rem);
		line-height: 1.65;
	}
	@media (min-width: 56rem) {
		.a-cols {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-5);
		}
		.a-side {
			order: 0;
			grid-column: 1 / 4;
			position: sticky;
			top: calc(var(--header-h) + var(--s-5));
			align-self: start;
		}
		.a-body {
			grid-column: 5 / 12;
		}
	}

	/* ----- B: Feature ----- */
	.b-hero {
		position: relative;
		min-height: 92svh;
		display: grid;
		align-items: end;
		color: #fff;
		isolation: isolate;
	}
	.photo {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: var(--slate);
	}
	.photo::after {
		content: '';
		position: absolute;
		inset: 30% 0 0;
		background: linear-gradient(transparent, rgb(20 12 8 / 0.82)); /* neutral scrim under text on a photograph, taste-skill-ignore */
	}
	.inner {
		display: grid;
		gap: var(--s-4);
		padding-block: var(--s-7) var(--s-6);
	}
	.b-hero h1 {
		font-size: clamp(3rem, 0.8rem + 9vw, 8.5rem);
	}
	.inner .small {
		color: inherit;
		opacity: 0.92;
	}
	.b-wrap {
		display: grid;
		gap: var(--s-6);
		max-width: 46rem;
		margin-inline: auto;
		padding-bottom: var(--section);
	}
	.b-body :global(.prose) {
		max-width: none;
		font-size: clamp(1.1875rem, 1.1rem + 0.45vw, 1.4rem);
		line-height: 1.65;
	}
	.b-body :global(.prose > p:first-child) {
		font-size: var(--step-lead);
		line-height: 1.4;
	}
	.b-foot {
		display: grid;
		gap: var(--s-4);
	}
	.b-next {
		display: grid;
	}
	.b-next :global(.b-nextlink) {
		display: grid;
		gap: var(--s-3);
		align-content: center;
		padding: var(--s-7) var(--gutter);
		text-decoration: none;
		min-height: 14rem;
	}
	.b-next :global(.b-nextlink .t) {
		font: 700 clamp(2.4rem, 1.4rem + 4vw, 5rem) / 0.95 var(--font-display);
	}
	.b-next :global(.b-nextlink:hover .t) {
		color: var(--apricot);
	}
	.b-next :global(.b-nextpic),
	.b-next :global(.b-nextpic .img) {
		border-radius: 0;
	}
	@media (min-width: 56rem) {
		.b-next {
			grid-template-columns: 1fr 1fr;
			align-items: stretch;
		}
		.b-next :global(.b-nextpic) {
			height: 100%;
			aspect-ratio: auto !important;
			min-height: 22rem;
		}
		.b-next :global(.b-nextlink) {
			padding-left: max(var(--gutter), calc((100vw - var(--max)) / 2 + var(--gutter)));
		}
	}

	/* ----- C: Letter ----- */
	.c-wrap {
		display: grid;
		gap: var(--s-6);
	}
	.c-side {
		display: grid;
		gap: var(--s-5);
		align-content: start;
		padding-top: var(--s-4);
		border-top: 2px solid var(--ink);
	}
	.c-side dl {
		display: grid;
		gap: var(--s-4);
	}
	.c-side dd {
		font-weight: 600;
	}
	.c-main {
		display: grid;
		gap: var(--s-5);
		align-content: start;
		min-width: 0;
	}
	.c-main h1 {
		font-size: clamp(2.8rem, 1.2rem + 6vw, 6rem);
	}
	.c-main :global(.prose) {
		font-size: clamp(1.125rem, 1.05rem + 0.35vw, 1.25rem);
		line-height: 1.65;
	}
	.sign {
		font: 700 clamp(2rem, 1.4rem + 2vw, 3rem) / 1 var(--font-display);
		padding-top: var(--s-4);
		border-top: 1px solid color-mix(in srgb, var(--ink) 30%, transparent); /* a real table row, taste-skill-ignore */
		max-width: var(--measure);
	}
	@media (min-width: 56rem) {
		.c-wrap {
			grid-template-columns: 15rem minmax(0, 1fr);
			gap: var(--s-7);
			align-items: start;
		}
		.c-side {
			position: sticky;
			top: calc(var(--header-h) + var(--s-5));
		}
		.c-main {
			max-width: 50rem;
		}
	}
</style>
