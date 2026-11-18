<script lang="ts">
	// A CMS page (`/about`, ...): the page-level layout around its blocks, in three compositions.
	// A "Notebook": the title beside the page's cover, a quiet closing line. B "Vista": the cover is the
	// first screen (or the hero block is), a field with the call to action at the end. C "Index": a
	// sticky strip lists the page's sections so a long page can be scanned. The blocks themselves
	// follow the same design letter (see `blocks/`).
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import PageHead from '../PageHead.svelte';
	import Pic from '../Pic.svelte';
	import Section from '../Section.svelte';
	import RenderBlocks from '../blocks/RenderBlocks.svelte';
	import { asMedia } from '../media';
	import type { DesignId } from '../designs';
	import type { BlockExtras, Page, PageBlock } from '../types';

	interface Props {
		page: Page;
		blocks: PageBlock[];
		design: DesignId;
		extras: BlockExtras;
		tagline?: string | null;
	}
	let { page, blocks, design, extras, tagline }: Props = $props();
	const cover = $derived(asMedia(page.cover));
	const opensWithHero = $derived(blocks[0]?.blockType === 'hero');
	// Section names for C's strip (blocks without a heading, and the hero, are left out).
	const sections = $derived(
		blocks.flatMap((b) => {
			const heading = (b as { heading?: unknown }).heading;
			return b.blockType !== 'hero' && typeof heading === 'string' && heading ? [{ id: b.id, heading }] : [];
		}),
	);
</script>

{#if design === 'b'}
	{#if !opensWithHero}
		{#if cover}
			<header class="b-hero on-dark">
				<div class="photo"><Img media={cover} eager fit="cover" widths={[800, 1400, 2000]} sizes="100vw" alt="" /></div>
				<div class="container inner"><h1>{page.title}</h1></div>
			</header>
		{:else}
			<PageHead title={page.title} />
		{/if}
	{/if}
	<RenderBlocks {blocks} {design} {extras} />
	<Section tone="earth" class="b-end">
		<div class="end">
			{#if tagline}<p class="lead">{tagline}</p>{/if}
			<Link href="/contact" class="btn light">Enquire about a stay</Link>
		</div>
	</Section>
{:else if design === 'c'}
	<!-- The strip goes after the page's opening (title or hero), so it never sits under a floating header. -->
	{#if opensWithHero}
		<div id={`s-${blocks[0]!.id}`} class="anchor"><RenderBlocks blocks={[blocks[0]!]} {design} {extras} /></div>
	{:else}
		<PageHead title={page.title} />
	{/if}
	{#if sections.length > 1}
		<div class="c-index">
			<nav class="container" aria-label="On this page">
				<ul>
					{#each sections as s (s.id)}<li><a href={`#s-${s.id}`}>{s.heading}</a></li>{/each}
				</ul>
			</nav>
		</div>
	{/if}
	{#each opensWithHero ? blocks.slice(1) : blocks as b (b.id)}
		<div id={`s-${b.id}`} class="anchor"><RenderBlocks blocks={[b]} {design} {extras} /></div>
	{/each}
{:else}
	{#if !opensWithHero}
		{#if cover}
			<header class="container a-head pt-hdr">
				<h1>{page.title}</h1>
				<Pic media={cover} ratio={4 / 5} eager widths={[500, 900, 1300]} sizes="(min-width: 56rem) 30vw, 70vw" alt="" class="a-cover" />
			</header>
		{:else}
			<PageHead title={page.title} />
		{/if}
	{/if}
	<RenderBlocks {blocks} {design} {extras} />
	<Section>
		<p class="a-end lead">Something we have not answered? <Link href="/contact" class="link">Write to us</Link>.</p>
	</Section>
{/if}

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* ----- A: Notebook ----- */
	.a-head {
		display: grid;
		gap: var(--s-5);
		padding-bottom: var(--s-6);
	}
	.a-head h1 {
		font-size: clamp(3.4rem, 1rem + 10vw, 9rem);
	}
	.a-head :global(.a-cover) {
		width: 60%;
		justify-self: end;
	}
	.a-end {
		max-width: 28ch;
	}
	@media (min-width: 56rem) {
		.a-head {
			grid-template-columns: repeat(12, 1fr);
			align-items: end;
			gap: var(--s-5);
		}
		.a-head h1 {
			grid-column: 1 / 9;
			grid-row: 1;
			padding-bottom: var(--s-4);
		}
		.a-head :global(.a-cover) {
			grid-column: 9 / 13;
			grid-row: 1;
			width: 100%;
			margin-top: var(--s-7);
		}
	}

	/* ----- B: Vista ----- */
	.b-hero {
		position: relative;
		min-height: 80svh;
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
		inset: 35% 0 0;
		background: linear-gradient(transparent, rgb(20 12 8 / 0.8)); /* neutral scrim under text on a photograph, taste-skill-ignore */
	}
	.inner {
		padding-block: var(--s-7) var(--s-6);
	}
	.b-hero h1 {
		font-size: clamp(3.4rem, 0.8rem + 12vw, 11rem);
	}
	.end {
		display: grid;
		gap: var(--s-5);
		justify-items: start;
	}
	.end .lead {
		max-width: 24ch;
		font-size: clamp(1.8rem, 1.2rem + 2.4vw, 3rem);
		font-family: var(--font-display);
		font-weight: 700;
		line-height: 1.05;
	}

	/* ----- C: Index ----- */
	.c-index {
		position: sticky;
		top: var(--header-h);
		z-index: 5;
		background: var(--bg);
		border-block: 1px solid color-mix(in srgb, var(--ink) 28%, transparent);
	}
	.c-index ul {
		display: flex;
		gap: 0 var(--s-5);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.c-index a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		white-space: nowrap;
		font-weight: 600;
		text-decoration: none;
	}
	.c-index a:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.25em;
	}
	.anchor {
		scroll-margin-top: calc(var(--header-h) + 3.5rem);
	}
</style>
