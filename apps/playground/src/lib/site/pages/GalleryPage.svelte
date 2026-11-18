<script lang="ts">
	// The gallery page, three compositions, all opening the same lightbox. A "Wall": pictures at uneven
	// sizes like prints. B "Reel": each album is one edge-to-edge row you drag or scroll. C "Contact
	// sheet": equal tiles, captions and credits visible, an album index in a sticky bar.
	import PageHead from '../PageHead.svelte';
	import Pic from '../Pic.svelte';
	import Section from '../Section.svelte';
	import Lightbox from '../lightbox/Lightbox.svelte';
	import { asMediaList, type Media } from '../media';
	import { reveal } from '../reveal';
	import type { DesignId } from '../designs';
	import type { Album } from '../types';

	let { albums, design = 'a' }: { albums: Album[]; design?: DesignId } = $props();
	const lists = $derived(
		albums
			.map((a) => ({ id: a.id, slug: a.slug, title: a.title, description: a.description, images: asMediaList(a.images) }))
			.filter((a) => a.images.length),
	);
	let active = $state(0);
	let index = $state<number | null>(null);
	const open = (a: number, i: number) => {
		active = a;
		index = i;
	};
	const SHAPES = [
		[4 / 5, 'tall'],
		[3 / 2, 'wide'],
		[1, 'sq'],
		[3 / 2, 'wide'],
		[4 / 5, 'tall'],
		[1, 'sq'],
	] as const;
	const label = (m: Media) => `View photograph${m.alt ? `: ${m.alt}` : ''}`;
</script>

<!-- Internal links and anchors are plain paths built here, not routes to resolve. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<PageHead title="Gallery" lead="The house, the orchard, the monasteries and the road. Select a picture to see it large, with its credit." />

{#if design === 'b'}
	{#each lists as a, ai (a.id)}
		<Section bleed pad={ai === 0 ? 'none' : 'top'} label={a.title}>
			<div class="container b-head">
				<h2>{a.title}</h2>
				<p class="small">{a.images.length} photographs. Scroll sideways.</p>
			</div>
			<ul class="row" role="list">
				{#each a.images as m, i (m.id)}
					<li class={`m${i % 4}`}>
						<button type="button" class="tile" aria-label={label(m)} onclick={() => open(ai, i)}>
							<Pic media={m} fill widths={[500, 900, 1400]} sizes="(min-width: 56rem) 40vw, 80vw" alt="" />
						</button>
					</li>
				{/each}
			</ul>
		</Section>
	{/each}
{:else if design === 'c'}
	<div class="c-index" role="navigation" aria-label="Albums">
		<ul class="container">
			{#each lists as a (a.id)}<li><a href={`#album-${a.slug}`}>{a.title}</a></li>{/each}
		</ul>
	</div>
	{#each lists as a, ai (a.id)}
		<Section tone={ai % 2 ? 'bg' : 'surface'} id={`album-${a.slug}`} label={a.title} class="c-album">
			<div class="c-head">
				<h2>{a.title}</h2>
				{#if a.description}<p class="lead">{a.description}</p>{/if}
			</div>
			<ul class="grid">
				{#each a.images as m, i (m.id)}
					<li class="reveal" use:reveal>
						<button type="button" class="tile" aria-label={label(m)} onclick={() => open(ai, i)}>
							<Pic media={m} ratio={3 / 2} widths={[400, 700, 1000]} sizes="(min-width: 64rem) 24vw, (min-width: 40rem) 33vw, 50vw" alt="" />
						</button>
						<p class="small">{m.alt ?? ''}{#if m.credit}<span> Photo: {m.credit}</span>{/if}</p>
					</li>
				{/each}
			</ul>
		</Section>
	{/each}
{:else}
	{#each lists as a, ai (a.id)}
		<Section label={a.title}>
			<h2 class="a-title">{a.title}</h2>
			<ul class="mosaic">
				{#each a.images as m, i (m.id)}
					{@const s = SHAPES[i % SHAPES.length]!}
					<li class={['reveal', s[1]]} use:reveal style:--i={i % 3}>
						<button type="button" class="tile" aria-label={label(m)} onclick={() => open(ai, i)}>
							<Pic media={m} ratio={s[0]} widths={[400, 800, 1200]} sizes="(min-width: 56rem) 33vw, 50vw" alt="" />
						</button>
					</li>
				{/each}
			</ul>
		</Section>
	{/each}
{/if}

<p class="container credits small">Photograph credits and licences are on the <a href="/credits">credits page</a>.</p>

<Lightbox images={lists[active]?.images ?? []} bind:index label={lists[active]?.title ?? 'Photographs'} />

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.tile {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: zoom-in;
		border-radius: var(--radius);
	}
	.tile:hover :global(.pic) {
		filter: brightness(1.06);
	}
	.credits {
		padding-block: var(--section) var(--s-7);
	}

	/* ----- A: Wall ----- */
	.a-title {
		margin-bottom: var(--s-6);
		font-size: clamp(2.6rem, 1.2rem + 5vw, 5.5rem);
	}
	.mosaic {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--s-3);
		align-items: start;
	}
	.mosaic .wide {
		grid-column: 1 / -1;
	}
	@media (min-width: 56rem) {
		.mosaic {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-5);
		}
		.mosaic .tall,
		.mosaic .sq {
			grid-column: span 3;
		}
		.mosaic .wide {
			grid-column: span 6;
		}
		.mosaic li:nth-child(3n + 2) {
			margin-top: var(--s-7);
		}
	}

	/* ----- B: Reel ----- */
	.b-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--s-4);
		flex-wrap: wrap;
		margin-bottom: var(--s-5);
	}
	.b-head h2 {
		font-size: clamp(2.6rem, 1.2rem + 5vw, 5.5rem);
	}
	.row {
		display: flex;
		gap: var(--s-3);
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		padding-inline: var(--gutter);
		height: 68svh;
		min-height: 22rem;
		overscroll-behavior-x: contain;
	}
	.row::-webkit-scrollbar {
		display: none;
	}
	.row li {
		flex: none;
		height: 100%;
		scroll-snap-align: start;
		scroll-margin-left: var(--gutter);
		width: 72vw;
	}
	.row li:nth-child(4n + 2) {
		width: 88vw;
	}
	@media (min-width: 56rem) {
		.row li {
			width: 26vw;
		}
		.row li:nth-child(4n + 2) {
			width: 46vw;
		}
	}

	/* ----- C: Contact sheet ----- */
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
	.c-head {
		display: grid;
		gap: var(--s-3);
		margin-bottom: var(--s-6);
	}
	.c-head h2 {
		font-size: clamp(2.2rem, 1.2rem + 3.6vw, 4rem);
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-5) var(--s-3);
	}
	.grid li {
		display: grid;
		gap: var(--s-2);
		align-content: start;
	}
	.grid .small span {
		display: block;
	}
	@media (min-width: 40rem) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
			gap: var(--s-5) var(--s-4);
		}
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}
</style>
