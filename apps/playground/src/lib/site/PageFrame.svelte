<script lang="ts">
	// A CMS page (`/about`, `/process`, ...): the page-level frame around its blocks, in three
	// compositions. When the page opens with a hero block, the hero is the opening and the frame adds
	// only its closing. The blocks follow the same design letter (see `blocks/`).
	// A "Editorial": the title very large beside the cover picture. B "Immersive": the cover is the first
	// screen with the title on it (an accent field without a cover). C "Structured": the title on a tint
	// with a short contents list. Header C floats, but `main` is padded below it (site.css), so none of
	// these ever sit under it.
	import type { DesignId } from './designs';
	import Img from './Img.svelte';
	import { asMedia } from './media';
	import Pic from './Pic.svelte';
	import RenderBlocks from './blocks/RenderBlocks.svelte';
	import type { BlockExtras, Page, PageBlock } from './types';

	interface Props {
		page: Page;
		blocks: PageBlock[];
		design: DesignId;
		extras: BlockExtras;
	}
	let { page, blocks, design, extras }: Props = $props();
	const cover = $derived(asMedia(page.cover));
	const opensWithHero = $derived(blocks[0]?.blockType === 'hero');
	// Section names for C's contents (blocks without a heading, and the hero, are left out).
	const sections = $derived(
		blocks.flatMap((b) => {
			const heading = (b as { heading?: unknown }).heading;
			return b.blockType !== 'hero' && typeof heading === 'string' && heading ? [{ id: b.id, heading }] : [];
		}),
	);
</script>

{#if !opensWithHero}
	{#if design === 'b'}
		{#if cover}
			<header class="b photo">
				<div class="bg"><Img media={cover} fit="cover" widths={[800, 1400, 1600]} sizes="100vw" eager alt="" /></div>
				<div class="container inner"><h1>{page.title}</h1></div>
			</header>
		{:else}
			<header class="b accent-field"><div class="container inner"><h1>{page.title}</h1></div></header>
		{/if}
	{:else if design === 'c'}
		<header class="c surface">
			<div class="container grid">
				<h1>{page.title}</h1>
				{#if sections.length > 1}
					<nav aria-label="On this page">
						<ul>
							{#each sections as s (s.id)}<li><a href={`#s-${s.id}`}>{s.heading}</a></li>{/each}
						</ul>
					</nav>
				{/if}
			</div>
		</header>
	{:else}
		<header class="container a">
			<h1>{page.title}</h1>
			{#if cover}<Pic media={cover} ratio={4 / 5} eager widths={[500, 900, 1300]} sizes="(min-width: 56rem) 30vw, 70vw" alt="" class="cover" />{/if}
		</header>
	{/if}
{/if}

{#each blocks as b (b.id)}
	<div id={`s-${b.id}`} class="anchor"><RenderBlocks blocks={[b]} {design} {extras} /></div>
{/each}

<style>
	.anchor {
		scroll-margin-top: calc(var(--header-h) + 1rem);
	}
	ul {
		list-style: none;
	}

	/* A */
	.a {
		display: grid;
		gap: var(--s-5);
		padding-block: var(--s-5) var(--s-6);
	}
	.a h1 {
		font-size: clamp(3.4rem, 1rem + 10vw, 9rem);
	}
	.a :global(.cover) {
		width: 60%;
		justify-self: end;
	}
	@media (min-width: 56rem) {
		.a {
			grid-template-columns: repeat(12, 1fr);
			align-items: end;
		}
		.a h1 {
			grid-column: 1 / 9;
			grid-row: 1;
			padding-bottom: var(--s-4);
		}
		.a :global(.cover) {
			grid-column: 9 / 13;
			grid-row: 1;
			width: 100%;
		}
	}

	/* B */
	.b {
		position: relative;
		display: flex;
		align-items: flex-end;
		min-height: clamp(22rem, 62svh, 40rem);
		padding-block: var(--s-7) var(--s-6);
		overflow: hidden;
	}
	.b.photo {
		color: #fff;
		background: #26282a;
	}
	.b .bg {
		position: absolute;
		inset: 0;
	}
	.b.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(0 0 0 / 0.8), rgb(0 0 0 / 0.3) 60%, rgb(0 0 0 / 0.2));
	}
	.b .inner {
		position: relative;
		z-index: 1;
	}
	.b h1 {
		font-size: clamp(3.4rem, 0.8rem + 11vw, 10rem);
	}

	/* C */
	.c {
		padding-block: var(--s-6);
	}
	.c .grid {
		display: grid;
		gap: var(--s-4);
	}
	.c h1 {
		font-size: clamp(3rem, 1rem + 8vw, 8rem);
	}
	.c nav a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		text-decoration: none;
		font-weight: 600;
	}
	.c nav a:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.25em;
	}
	@media (min-width: 56rem) {
		.c .grid {
			grid-template-columns: 8fr 4fr;
			align-items: end;
			gap: var(--s-6);
		}
	}
</style>
