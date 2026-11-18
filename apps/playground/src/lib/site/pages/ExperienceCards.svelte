<script lang="ts">
	// Experiences, three compositions (also used by the `experiencesList` block).
	// A "Trails": pictures at uneven sizes on a 12-column grid, the heading cutting into the picture's
	// corner. B "Postcards": full-bleed photographs, each with one solid message card; on wide screens
	// one band that opens the panel you point at. C "Itinerary": a table on column lines, facts in columns.
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import { asMedia } from '../media';
	import { DIFFICULTY_LABELS } from '../format';
	import { reveal } from '../reveal';
	import type { DesignId } from '../designs';
	import type { Experience } from '../types';

	let { items, design = 'a', limit }: { items: Experience[]; design?: DesignId; limit?: number } = $props();
	const shown = $derived(limit ? items.slice(0, limit) : items);
	const facts = (e: Experience) => [e.duration, e.difficulty ? DIFFICULTY_LABELS[e.difficulty] : '', e.season].filter(Boolean).join(', ');
	// Picture shapes for A: a repeating set so neighbours never match.
	const RATIOS = [4 / 5, 1, 3 / 2, 1, 3 / 2, 4 / 5];
</script>

{#if design === 'b'}
	<ul class="cards">
		{#each shown as e, i (e.id)}
			<li style:--g={[5, 2, 3, 2, 4, 3][i % 6]}>
				<Link href={`/experiences/${e.slug}`} class="card">
					<span class="ph"><Pic media={asMedia(e.cover)} fill sizes="(min-width: 56rem) 40vw, 100vw" widths={[600, 1000, 1600]} /></span>
					<span class="msg on-dark">
						<strong>{e.title}</strong>
						<span class="sum">{e.summary}</span>
						<small>{facts(e)}</small>
					</span>
				</Link>
			</li>
		{/each}
	</ul>
{:else if design === 'c'}
	<div class="sheet">
		<p class="cols small" aria-hidden="true"><span>Experience</span><span>Time</span><span>Effort</span><span>Season</span></p>
		<ul class="rows">
			{#each shown as e (e.id)}
				<li class="reveal" use:reveal>
					<Link href={`/experiences/${e.slug}`} class="row">
						<span class="thumb"><Pic media={asMedia(e.cover)} ratio={1} widths={[200, 400]} sizes="8rem" /></span>
						<span class="t"><strong>{e.title}</strong><span class="sum">{e.summary}</span></span>
						<span class="f run small">{facts(e)}</span>
						<span class="f small"><span class="sr-only">Time: </span>{e.duration ?? ''}</span>
						<span class="f small"><span class="sr-only">Effort: </span>{e.difficulty ? DIFFICULTY_LABELS[e.difficulty] : ''}</span>
						<span class="f small"><span class="sr-only">Season: </span>{e.season ?? ''}</span>
					</Link>
				</li>
			{/each}
		</ul>
	</div>
{:else}
	<ul class="trails">
		{#each shown as e, i (e.id)}
			<li class="reveal" use:reveal style:--i={i % 3}>
				<Link href={`/experiences/${e.slug}`} class="trail">
					<Pic media={asMedia(e.cover)} ratio={RATIOS[i % RATIOS.length]} sizes="(min-width: 56rem) 40vw, 90vw" />
					<span class="notch"><h3>{e.title}</h3></span>
					<span class="small">{facts(e)}</span>
					<span class="sum">{e.summary}</span>
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

	/* ----- A: Trails ----- */
	.trails {
		display: grid;
		gap: var(--s-7);
	}
	.trails :global(.trail) {
		display: grid;
		gap: var(--s-2);
		align-content: start;
	}
	.trails li:nth-child(even) {
		margin-left: 14%;
	}
	.trails li:nth-child(odd) {
		margin-right: 14%;
	}
	/* The heading sits on a notch of page ground cut into the picture's lower corner. */
	.notch {
		display: block;
		justify-self: start;
		margin-top: -1.6rem;
		padding: var(--s-2) var(--s-4) 0 0;
		background: var(--bg);
		position: relative;
		max-width: 92%;
	}
	.trails .sum {
		max-width: 38ch;
	}
	.trails :global(.trail:hover h3) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.12em;
	}
	@media (min-width: 56rem) {
		.trails {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-7) var(--s-5);
			align-items: start;
		}
		.trails li {
			margin: 0 !important;
		}
		.trails li:nth-child(6n + 1) {
			grid-column: span 5;
		}
		.trails li:nth-child(6n + 2) {
			grid-column: span 4;
			margin-top: var(--s-7) !important;
		}
		.trails li:nth-child(6n + 3) {
			grid-column: span 3;
		}
		.trails li:nth-child(6n + 4) {
			grid-column: span 3;
		}
		.trails li:nth-child(6n + 5) {
			grid-column: span 4;
			margin-top: var(--s-6) !important;
		}
		.trails li:nth-child(6n) {
			grid-column: span 5;
		}
	}

	/* ----- B: Postcards ----- */
	.cards {
		display: grid;
		gap: var(--s-7);
	}
	.cards li {
		/* Photographs run to the screen edge on a phone. */
		margin-inline: calc(var(--gutter) * -1);
	}
	.cards :global(.card) {
		display: block;
	}
	.ph {
		display: block;
		aspect-ratio: 4 / 5;
	}
	.ph :global(.pic) {
		border-radius: 0;
	}
	.msg {
		display: grid;
		gap: var(--s-2);
		background: var(--slate);
		color: var(--slate-ink);
		padding: var(--s-5);
		margin: calc(var(--s-7) * -1) var(--gutter) 0 auto;
		width: min(88%, 30rem);
		position: relative;
	}
	.msg strong {
		font: 700 clamp(1.9rem, 1.4rem + 2vw, 2.6rem) / 1 var(--font-display);
	}
	.msg small {
		font-size: var(--step-small);
		color: var(--apricot);
	}
	@media (min-width: 56rem) {
		.cards {
			display: flex;
			gap: 0;
			height: 76svh;
			min-height: 34rem;
			margin-inline: calc(var(--gutter) * -1);
		}
		.cards li {
			margin: 0;
			flex: var(--g) 1 0;
			min-width: 0;
			position: relative;
			overflow: hidden;
			transition: flex-grow 0.6s var(--ease);
		}
		.cards li:hover,
		.cards li:focus-within,
		.cards:not(:has(li:hover, li:focus-within)) li:first-child {
			flex-grow: 7;
		}
		.cards li :global(.card),
		.ph,
		.ph :global(.pic) {
			position: absolute;
			inset: 0;
			aspect-ratio: auto;
			height: 100%;
		}
		.cards li :global(.card) {
			display: block;
		}
		.msg {
			position: absolute;
			inset: auto 0 0;
			width: auto;
			margin: 0;
			padding: var(--s-6) var(--s-5) var(--s-5);
			background: linear-gradient(transparent, rgb(20 12 8 / 0.82)); /* neutral scrim under text on a photograph, taste-skill-ignore */
			color: #fff;
		}
		/* A closed panel carries its name upright along the edge; the open one reads normally. */
		.msg strong {
			writing-mode: vertical-rl;
			transform: rotate(180deg);
			max-height: 16rem;
			overflow: hidden;
			white-space: nowrap;
		}
		.cards li:hover strong,
		.cards li:focus-within strong,
		.cards:not(:has(li:hover, li:focus-within)) li:first-child strong {
			writing-mode: horizontal-tb;
			transform: none;
			max-height: none;
			white-space: normal;
		}
		.msg .sum,
		.msg small {
			max-height: 0;
			opacity: 0;
			overflow: hidden;
			transition:
				max-height 0.5s var(--ease),
				opacity 0.4s var(--ease);
		}
		.cards li:hover .sum,
		.cards li:focus-within .sum,
		.cards li:hover small,
		.cards li:focus-within small,
		.cards:not(:has(li:hover, li:focus-within)) li:first-child .sum,
		.cards:not(:has(li:hover, li:focus-within)) li:first-child small {
			max-height: 9rem;
			opacity: 1;
		}
	}

	/* ----- C: Itinerary ----- */
	.sheet {
		border-top: 2px solid var(--ink);
	}
	.cols {
		display: none;
	}
	.rows li {
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 28%, transparent); /* a real table row, taste-skill-ignore */
	}
	.rows :global(.row) {
		display: grid;
		grid-template-columns: 5rem 1fr;
		gap: var(--s-1) var(--s-4);
		align-items: start;
		padding-block: var(--s-4);
	}
	.thumb {
		grid-row: span 2;
	}
	.t {
		display: grid;
		gap: var(--s-1);
		align-content: start;
	}
	.t strong {
		font: 700 clamp(1.7rem, 1.4rem + 1.2vw, 2.2rem) / 1.02 var(--font-display);
	}
	.rows :global(.row:hover strong) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.12em;
	}
	.f {
		display: none;
	}
	.f.run {
		display: block;
		grid-column: 2;
	}
	@media (min-width: 56rem) {
		.cols,
		.rows :global(.row) {
			grid-template-columns: 7rem minmax(0, 1fr) 9rem 8rem 11rem;
			gap: var(--s-5);
		}
		.cols {
			display: grid;
			padding-block: var(--s-3);
			border-bottom: 1px solid var(--ink); /* a real table row, taste-skill-ignore */
		}
		.cols span:first-child {
			grid-column: 1 / 3;
		}
		.rows :global(.row) {
			align-items: center;
			padding-block: var(--s-5);
		}
		.thumb {
			grid-row: auto;
		}
		.f {
			display: block;
			color: var(--ink);
			font-size: var(--step-body);
		}
		.f.run {
			display: none;
		}
	}
</style>
