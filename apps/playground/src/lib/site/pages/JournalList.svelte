<script lang="ts">
	// The journal list, three compositions. A "Field notes": one large entry beside its text, the rest
	// staggered, small. B "Cover story": the newest post is the first screen, the rest on a slate field.
	// C "Archive": a dated table grouped by year, topics in a sticky column.
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import PageHead from '../PageHead.svelte';
	import Pic from '../Pic.svelte';
	import Section from '../Section.svelte';
	import { fmtDate } from '../format';
	import { asMedia } from '../media';
	import { reveal } from '../reveal';
	import type { DesignId } from '../designs';
	import type { Post } from '../types';
	import Pager from './Pager.svelte';
	import { authorOf, tagsOf } from './postmeta';
	import TagFilter from './TagFilter.svelte';

	interface Props {
		posts: Post[];
		tags: { name: string; slug: string }[];
		activeTag: { name: string; slug: string } | null;
		page: number;
		totalPages: number;
		design?: DesignId;
	}
	let { posts, tags, activeTag, page, totalPages, design = 'a' }: Props = $props();
	const lead = 'Notes from the house: altitude, apricots, and the road.';
	const href = (p: Post) => `/journal/${p.slug}`;
	const topics = (p: Post) =>
		tagsOf(p)
			.map((t) => t.name)
			.join(', ');
	const first = $derived(posts[0]);
	const rest = $derived(posts.slice(1));
	const year = (p: Post) => (p.publishedAt ? new Date(p.publishedAt).getUTCFullYear() : '');
	const byYear = $derived.by(() => {
		const groups: { year: number | string; items: Post[] }[] = [];
		for (const p of posts) {
			const y = year(p);
			const g = groups.at(-1);
			if (g && g.year === y) g.items.push(p);
			else groups.push({ year: y, items: [p] });
		}
		return groups;
	});
	const RATIOS = [4 / 5, 1, 3 / 2, 1, 4 / 5, 3 / 2];
</script>

<!-- Internal links and anchors are plain paths built here, not routes to resolve. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

{#snippet empty()}
	<p class="empty lead">Nothing under {activeTag ? `“${activeTag.name}”` : 'this topic'} yet. <a href="/journal">See every note</a>.</p>
{/snippet}

{#if design === 'b'}
	<h1 class="sr-only">Journal{activeTag ? `: ${activeTag.name}` : ''}</h1>
	{#if first}
		<section class="b-hero on-dark" aria-label="Latest note">
			<Link href={href(first)} class="b-link">
				<span class="photo"><Img media={asMedia(first.cover)} eager fit="cover" widths={[800, 1400, 2000]} sizes="100vw" alt="" /></span>
				<span class="container inner">
					<span class="small">{fmtDate(first.publishedAt)}{authorOf(first) ? `, ${authorOf(first)?.name}` : ''}</span>
					<span class="title">{first.title}</span>
					<span class="lead">{first.excerpt}</span>
				</span>
			</Link>
		</section>
	{/if}
	<Section tone="slate" class="b-rest">
		<div class="b-bar">
			<TagFilter {tags} active={activeTag?.slug ?? null} onDark />
		</div>
		{#if !posts.length}
			{@render empty()}
		{:else}
			<ul class="b-grid">
				{#each rest as p, i (p.id)}
					<li class="reveal" use:reveal style:--i={i % 2}>
						<Link href={href(p)}>
							<Pic media={asMedia(p.cover)} ratio={i % 3 === 0 ? 16 / 10 : 4 / 3} sizes="(min-width: 56rem) 45vw, 100vw" />
							<span class="small">{fmtDate(p.publishedAt)}{topics(p) ? `, ${topics(p)}` : ''}</span>
							<h2>{p.title}</h2>
							<span class="x">{p.excerpt}</span>
						</Link>
					</li>
				{/each}
			</ul>
		{/if}
		<Pager {page} {totalPages} tag={activeTag?.slug ?? null} />
	</Section>
{:else if design === 'c'}
	<PageHead title="Journal" {lead} />
	<div class="container c-wrap">
		<aside class="c-side">
			<h2 class="small">Topics</h2>
			<TagFilter {tags} active={activeTag?.slug ?? null} layout="column" />
		</aside>
		<div class="c-main">
			{#if !posts.length}
				{@render empty()}
			{/if}
			{#each byYear as g (g.year)}
				<section class="c-year" aria-label={String(g.year)}>
					<h2 class="yr">{g.year}</h2>
					<ul>
						{#each g.items as p (p.id)}
							<li class="reveal" use:reveal>
								<Link href={href(p)} class="c-row">
									<span class="thumb"><Pic media={asMedia(p.cover)} ratio={1} widths={[200, 400]} sizes="7rem" /></span>
									<span class="when small">{fmtDate(p.publishedAt, { day: 'numeric', month: 'short' })}</span>
									<span class="t"><strong>{p.title}</strong><span class="x">{p.excerpt}</span></span>
									<span class="by small">{[authorOf(p)?.name, topics(p)].filter(Boolean).join(', ')}</span>
								</Link>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
			<Pager {page} {totalPages} tag={activeTag?.slug ?? null} />
		</div>
	</div>
{:else}
	<PageHead title="Journal" {lead} />
	<div class="container a-wrap">
		<TagFilter {tags} active={activeTag?.slug ?? null} />
		{#if !posts.length}
			{@render empty()}
		{:else}
			{#if first}
				<article class="a-feature reveal" use:reveal>
					<Link href={href(first)} class="a-pic"><Pic media={asMedia(first.cover)} ratio={3 / 2} eager sizes="(min-width: 56rem) 62vw, 100vw" widths={[700, 1200, 1800]} alt="" /></Link>
					<div class="a-text">
						<p class="small">{fmtDate(first.publishedAt)}{authorOf(first) ? `, ${authorOf(first)?.name}` : ''}</p>
						<h2><Link href={href(first)}>{first.title}</Link></h2>
						<p>{first.excerpt}</p>
						{#if topics(first)}<p class="small">{topics(first)}</p>{/if}
					</div>
				</article>
			{/if}
			<ul class="a-grid">
				{#each rest as p, i (p.id)}
					<li class="reveal" use:reveal style:--i={i % 3}>
						<Link href={href(p)}>
							<Pic media={asMedia(p.cover)} ratio={RATIOS[i % RATIOS.length]} sizes="(min-width: 56rem) 28vw, 90vw" />
							<span class="small">{fmtDate(p.publishedAt)}{topics(p) ? `, ${topics(p)}` : ''}</span>
							<h3>{p.title}</h3>
							<span class="x">{p.excerpt}</span>
						</Link>
					</li>
				{/each}
			</ul>
		{/if}
		<Pager {page} {totalPages} tag={activeTag?.slug ?? null} />
	</div>
{/if}

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li :global(a),
	.b-hero :global(a) {
		text-decoration: none;
	}
	.inner .small {
		color: inherit;
		opacity: 0.92;
	}
	.empty {
		max-width: 40ch;
		margin-top: var(--s-6);
	}

	/* ----- A: Field notes ----- */
	.a-wrap {
		padding-bottom: var(--s-7);
		display: grid;
		gap: var(--s-6);
	}
	.a-feature {
		display: grid;
		gap: var(--s-4);
	}
	.a-text {
		display: grid;
		gap: var(--s-3);
		align-content: start;
	}
	.a-text h2 {
		font-size: clamp(2.4rem, 1.4rem + 3.6vw, 4.2rem);
		line-height: 0.96;
	}
	.a-text h2 :global(a) {
		text-decoration: none;
	}
	.a-text h2 :global(a:hover) {
		text-decoration: underline;
		text-decoration-thickness: 3px;
		text-underline-offset: 0.1em;
	}
	.a-grid {
		display: grid;
		gap: var(--s-7);
		margin-top: var(--s-5);
	}
	.a-grid :global(a) {
		display: grid;
		gap: var(--s-2);
		align-content: start;
	}
	.a-grid h3 {
		margin-top: var(--s-1);
	}
	.a-grid :global(a:hover h3) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.12em;
	}
	.x {
		max-width: 40ch;
	}
	@media (min-width: 56rem) {
		.a-feature {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-5);
			align-items: end;
		}
		.a-feature :global(.a-pic) {
			grid-column: 1 / 9;
		}
		.a-text {
			grid-column: 9 / 13;
			padding-bottom: var(--s-2);
		}
		.a-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: var(--s-7) var(--s-5);
			align-items: start;
		}
		.a-grid li:nth-child(3n + 2) {
			margin-top: var(--s-7);
		}
		.a-grid li:nth-child(3n + 3) {
			margin-top: var(--s-5);
		}
	}

	/* ----- B: Cover story ----- */
	.b-hero {
		position: relative;
		min-height: 88svh;
		display: grid;
		color: #fff;
		isolation: isolate;
	}
	.b-hero :global(.b-link) {
		display: grid;
		align-items: end;
		min-height: 88svh;
		color: inherit;
	}
	.photo {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: var(--slate);
		display: block;
	}
	.photo::after {
		content: '';
		position: absolute;
		inset: 30% 0 0;
		background: linear-gradient(transparent, rgb(20 12 8 / 0.82)); /* neutral scrim under text on a photograph, taste-skill-ignore */
	}
	.inner {
		display: grid;
		gap: var(--s-3);
		padding-block: var(--s-7) var(--s-6);
	}
	.title {
		font: 700 clamp(3.4rem, 0.8rem + 12vw, 10.5rem) / 0.9 var(--font-display);
		text-transform: uppercase;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.inner .lead {
		max-width: 38ch;
	}
	.b-bar {
		margin-bottom: var(--s-6);
	}
	.b-grid {
		display: grid;
		gap: var(--s-7);
	}
	.b-grid :global(a) {
		display: grid;
		gap: var(--s-2);
		align-content: start;
		color: inherit;
	}
	.b-grid h2 {
		font-size: clamp(2rem, 1.3rem + 2.6vw, 3.4rem);
	}
	.b-grid :global(a:hover h2) {
		color: var(--apricot);
	}
	@media (min-width: 56rem) {
		.b-grid {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-7) var(--s-6);
		}
		.b-grid li:nth-child(even) {
			margin-top: var(--s-7);
		}
	}

	/* ----- C: Archive ----- */
	.c-wrap {
		display: grid;
		gap: var(--s-5);
		padding-bottom: var(--s-7);
	}
	.c-side h2 {
		font: 600 var(--step-small) / 1 var(--font-text);
		text-transform: none;
		color: var(--muted);
		margin-bottom: var(--s-2);
	}
	.c-main {
		min-width: 0;
	}
	.c-year {
		border-top: 2px solid var(--ink);
		margin-bottom: var(--s-6);
	}
	.yr {
		font-size: clamp(2.4rem, 1.4rem + 3vw, 3.6rem);
		padding-block: var(--s-3);
	}
	.c-year li {
		border-top: 1px solid color-mix(in srgb, var(--ink) 28%, transparent); /* a real table row, taste-skill-ignore */
	}
	.c-year li :global(.c-row) {
		display: grid;
		grid-template-columns: 5rem 1fr;
		gap: var(--s-1) var(--s-4);
		padding-block: var(--s-4);
		align-items: start;
	}
	.thumb {
		grid-row: span 3;
	}
	.t {
		display: grid;
		gap: var(--s-1);
	}
	.t strong {
		font: 700 clamp(1.6rem, 1.3rem + 1vw, 2.1rem) / 1.05 var(--font-display);
	}
	.c-year li :global(.c-row:hover strong) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.12em;
	}
	.when {
		order: -1;
		grid-column: 2;
	}
	.t,
	.by {
		grid-column: 2;
	}
	@media (min-width: 56rem) {
		.c-wrap {
			grid-template-columns: 12rem minmax(0, 1fr);
			gap: var(--s-7);
			align-items: start;
		}
		.c-side {
			position: sticky;
			top: calc(var(--header-h) + var(--s-5));
		}
		.c-year {
			display: grid;
			grid-template-columns: 7rem 1fr;
		}
		.yr {
			padding-top: var(--s-4);
		}
		.c-year li :global(.c-row) {
			grid-template-columns: 6rem 6rem minmax(0, 1fr) 11rem;
			gap: var(--s-5);
			align-items: center;
			padding-block: var(--s-5);
		}
		.c-year li:first-child {
			border-top: 0;
		}
		.thumb {
			grid-row: 1;
			grid-column: 2;
		}
		.when {
			order: 0;
			grid-row: 1;
			grid-column: 1;
		}
		.t {
			grid-row: 1;
			grid-column: 3;
		}
		.by {
			grid-row: 1;
			grid-column: 4;
		}
	}
</style>
