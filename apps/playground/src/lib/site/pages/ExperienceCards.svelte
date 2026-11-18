<script lang="ts">
	// Experiences, three layouts. A "Trails": staggered columns. B "Postcards": a band of unequal
	// panels. C "Itinerary": plain rows with the facts in a column. (Part 2 refines these.)
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import { asMedia } from '../media';
	import { DIFFICULTY_LABELS } from '../format';
	import { reveal } from '../reveal';
	import type { DesignId } from '../designs';
	import type { Experience } from '../types';

	let { items, design = 'a', limit }: { items: Experience[]; design?: DesignId; limit?: number } = $props();
	const shown = $derived(limit ? items.slice(0, limit) : items);
	const meta = (e: Experience) => [e.duration, e.difficulty ? DIFFICULTY_LABELS[e.difficulty] : '', e.season].filter(Boolean).join(', ');
</script>

{#if design === 'b'}
	<ul class="band">
		{#each shown as e, i (e.id)}
			<li style:--g={[5, 2, 3, 2, 4, 3][i % 6]}>
				<Link href={`/experiences/${e.slug}`}>
					<Pic media={asMedia(e.cover)} fill sizes="(min-width: 56rem) 30vw, 100vw" widths={[500, 900]} />
					<span class="cap on-dark"><strong>{e.title}</strong><small>{meta(e)}</small></span>
				</Link>
			</li>
		{/each}
	</ul>
{:else if design === 'c'}
	<ul class="list">
		{#each shown as e (e.id)}
			<li class="reveal" use:reveal>
				<Link href={`/experiences/${e.slug}`} class="row">
					<span class="thumb"><Pic media={asMedia(e.cover)} ratio={1} widths={[200, 400]} sizes="8rem" /></span>
					<span class="t"><strong>{e.title}</strong><span>{e.summary}</span></span>
					<span class="m small">{meta(e)}</span>
				</Link>
			</li>
		{/each}
	</ul>
{:else}
	<ul class="trails">
		{#each shown as e, i (e.id)}
			<li class="reveal" use:reveal style:--i={i % 3}>
				<Link href={`/experiences/${e.slug}`}>
					<Pic media={asMedia(e.cover)} ratio={i % 2 ? 4 / 5 : 1} sizes="(min-width: 56rem) 30vw, 100vw" />
					<h3>{e.title}</h3>
					<p class="small">{meta(e)}</p>
					<p>{e.summary}</p>
				</Link>
			</li>
		{/each}
	</ul>
{/if}

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li :global(a) {
		text-decoration: none;
	}
	/* A */
	.trails {
		display: grid;
		gap: var(--s-6);
	}
	.trails li :global(a) {
		display: grid;
		gap: var(--s-2);
	}
	.trails h3 {
		margin-top: var(--s-2);
	}
	@media (min-width: 56rem) {
		.trails {
			grid-template-columns: repeat(3, 1fr);
			gap: var(--s-6) var(--s-5);
			align-items: start;
		}
		.trails li:nth-child(3n + 2) {
			margin-top: var(--s-7);
		}
	}
	/* B */
	.band {
		display: grid;
		gap: var(--s-2);
		grid-template-columns: 1fr 1fr;
	}
	.band li {
		position: relative;
		aspect-ratio: 3 / 4;
		overflow: hidden;
	}
	.band li:nth-child(3n + 1) {
		grid-column: 1 / -1;
		aspect-ratio: 16 / 10;
	}
	.band li :global(a) {
		position: absolute;
		inset: 0;
		display: block;
	}
	.cap {
		position: absolute;
		inset: auto 0 0;
		padding: var(--s-5) var(--s-4) var(--s-4);
		background: linear-gradient(transparent, rgb(20 12 8 / 0.78)); /* neutral scrim under text on a photograph, taste-skill-ignore */
		color: #fff;
		display: grid;
		gap: var(--s-1);
	}
	.cap strong {
		font: 700 clamp(1.5rem, 1.2rem + 1vw, 2rem) / 1.05 var(--font-display);
	}
	@media (min-width: 56rem) {
		.band {
			display: flex;
			gap: 0;
			height: 68svh;
		}
		.band li,
		.band li:nth-child(3n + 1) {
			aspect-ratio: auto;
			flex: var(--g) 1 0;
			transition: flex-grow 0.5s var(--ease);
		}
		.band li:hover,
		.band li:focus-within {
			flex-grow: 6;
		}
	}
	/* C */
	.list :global(.row) {
		display: grid;
		grid-template-columns: 5rem 1fr;
		gap: var(--s-4);
		align-items: center;
		padding-block: var(--s-4);
	}
	.list li:nth-child(odd) {
		background: var(--surface);
		margin-inline: calc(var(--gutter) * -1);
		padding-inline: var(--gutter);
	}
	.t {
		display: grid;
		gap: var(--s-1);
	}
	.t strong {
		font: 700 1.7rem/1.05 var(--font-display);
	}
	.m {
		grid-column: 2;
	}
	@media (min-width: 56rem) {
		.list :global(.row) {
			grid-template-columns: 8rem 1fr 14rem;
			gap: var(--s-6);
		}
		.m {
			grid-column: auto;
		}
	}
</style>
