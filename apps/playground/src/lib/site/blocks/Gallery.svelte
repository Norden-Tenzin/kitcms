<script lang="ts">
	// Gallery block. A pictures at uneven sizes. B a draggable row, edge to edge. C a uniform grid
	// with credits. Pictures come from the chosen album or from the block's own list.
	import Pic from '../Pic.svelte';
	import Section from '../Section.svelte';
	import { asDoc, asMediaList, type Media } from '../media';
	import { reveal } from '../reveal';
	import type { Album } from '../types';
	import type { BlockProps } from './props';

	let { block, design = 'a', extras }: BlockProps<'gallery'> = $props();
	const images = $derived.by<Media[]>(() => {
		const own = asMediaList(block.images);
		if (own.length) return own;
		// The album arrives populated one level deep (its pictures are ids), so look it up in `extras`.
		const populated = asDoc<Album>(block.album);
		const id = populated?.id ?? (typeof block.album === 'string' ? block.album : '');
		const album = extras?.albums?.find((a) => a.id === id) ?? populated;
		return asMediaList(album?.images);
	});
	// The uneven designs repeat a small set of shapes (ratio, grid span).
	const SHAPES = [
		[4 / 5, 'tall'],
		[3 / 2, 'wide'],
		[1, 'sq'],
		[3 / 2, 'wide'],
		[4 / 5, 'tall'],
		[1, 'sq'],
	] as const;
</script>

{#if design === 'b'}
	<Section bleed>
		{#if block.heading}
			<div class="container head"><h2>{block.heading}</h2><p class="small">{images.length} photographs</p></div>
		{/if}
		<ul class="row" tabindex="-1">
			{#each images as m, i (m.id)}
				<li class="m{i % 4}">
					<Pic media={m} fill widths={[500, 900, 1400]} sizes="(min-width: 56rem) 40vw, 80vw" />
				</li>
			{/each}
		</ul>
	</Section>
{:else if design === 'c'}
	<Section>
		{#if block.heading}<h2 class="h">{block.heading}</h2>{/if}
		<ul class="grid">
			{#each images as m, i (m.id)}
				<li class="reveal" use:reveal style:--i={i % 3}>
					<Pic media={m} ratio={4 / 3} sizes="(min-width: 56rem) 30vw, (min-width: 40rem) 45vw, 100vw" />
					{#if m.alt}<p class="small">{m.alt}</p>{/if}
				</li>
			{/each}
		</ul>
	</Section>
{:else}
	<Section>
		{#if block.heading}<h2 class="h">{block.heading}</h2>{/if}
		<ul class="mosaic">
			{#each images as m, i (m.id)}
				{@const s = SHAPES[i % SHAPES.length]!}
				<li class={['reveal', s[1]]} use:reveal style:--i={i % 3}>
					<Pic media={m} ratio={s[0]} sizes="(min-width: 56rem) 33vw, 50vw" />
				</li>
			{/each}
		</ul>
	</Section>
{/if}

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.h {
		margin-bottom: var(--s-6);
	}
	/* A */
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
		.mosaic .tall {
			grid-column: span 3;
		}
		.mosaic .wide {
			grid-column: span 6;
		}
		.mosaic .sq {
			grid-column: span 3;
		}
		.mosaic li:nth-child(3n + 2) {
			margin-top: var(--s-7);
		}
	}
	/* B */
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: var(--s-5);
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
	/* C */
	.grid {
		display: grid;
		gap: var(--s-5);
		grid-template-columns: 1fr;
	}
	.grid li {
		display: grid;
		gap: var(--s-2);
	}
	@media (min-width: 40rem) {
		.grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
