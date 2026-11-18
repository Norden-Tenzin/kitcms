<script lang="ts">
	// Key facts. A figures at staggered sizes beside a picture. B one figure on a full-bleed photograph,
	// the rest below. C a slate table of four.
	import Pic from '../Pic.svelte';
	import Section from '../Section.svelte';
	import { asMedia } from '../media';
	import { reveal } from '../reveal';
	import type { BlockProps } from './props';

	let { block, design = 'a' }: BlockProps<'stats'> = $props();
	const items = $derived(block.items ?? []);
	const image = $derived(asMedia(block.image));
	const lead = $derived(items[0]);
	const rest = $derived(items.slice(1));
</script>

{#if design === 'b'}
	<Section bleed pad="none">
		<div class="stage on-dark">
			<Pic media={image} fill widths={[800, 1400, 2000]} sizes="100vw" class="bg" />
			<div class="container inside">
				{#if block.heading}<h2>{block.heading}</h2>{/if}
				{#if lead}
					<p class="big"><span class="fig">{lead.value}</span><span class="cap">{lead.label}{lead.note ? `. ${lead.note}` : ''}</span></p>
				{/if}
			</div>
		</div>
		<ul class="container rest">
			{#each rest as it, i (it.id ?? i)}
				<li class="reveal" use:reveal><strong>{it.value}</strong><span>{it.label}</span></li>
			{/each}
		</ul>
	</Section>
{:else if design === 'c'}
	<Section tone="slate">
		{#if block.heading}<h2 class="h">{block.heading}</h2>{/if}
		<ul class="table">
			{#each items as it, i (it.id ?? i)}
				<li class="reveal" use:reveal style:--i={i}>
					<strong>{it.value}</strong>
					<span>{it.label}</span>
					{#if it.note}<small>{it.note}</small>{/if}
				</li>
			{/each}
		</ul>
	</Section>
{:else}
	<Section>
		<div class="a">
			<div class="figs">
				{#if block.heading}<h2>{block.heading}</h2>{/if}
				<ul>
					{#each items as it, i (it.id ?? i)}
						<li class="reveal" use:reveal style:--i={i}>
							<strong>{it.value}</strong>
							<span>{it.label}{#if it.note}<small>{it.note}</small>{/if}</span>
						</li>
					{/each}
				</ul>
			</div>
			<Pic media={image} ratio={4 / 5} sizes="(min-width: 56rem) 38vw, 100vw" />
		</div>
	</Section>
{/if}

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	small {
		display: block;
		font-size: var(--step-small);
		opacity: 0.85;
	}
	.h {
		margin-bottom: var(--s-6);
	}
	/* A */
	.a {
		display: grid;
		gap: var(--s-6);
	}
	.figs {
		display: grid;
		gap: var(--s-5);
		align-content: start;
	}
	.a ul {
		display: grid;
		gap: var(--s-5);
	}
	.a li {
		display: grid;
		gap: var(--s-1);
	}
	.a strong {
		font: 700 clamp(3.5rem, 2rem + 6vw, 7rem) / 0.85 var(--font-display);
		color: var(--accent);
		text-transform: uppercase;
	}
	@media (min-width: 56rem) {
		.a {
			grid-template-columns: 7fr 5fr;
			gap: var(--s-7);
			align-items: start;
		}
		.a ul {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--s-6);
		}
		.a li:nth-child(even) {
			margin-top: var(--s-6);
		}
	}
	/* B */
	.stage {
		position: relative;
		min-height: 88svh;
		color: #fff;
		display: grid;
		isolation: isolate;
	}
	.stage :global(.bg) {
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: 0;
	}
	.stage::after {
		content: '';
		position: absolute;
		inset: 45% 0 0;
		z-index: -1;
		background: linear-gradient(transparent, rgb(20 12 8 / 0.78));
	}
	.inside {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding-block: var(--s-6);
	}
	.big {
		display: grid;
		gap: var(--s-3);
	}
	.fig {
		font: 700 clamp(6rem, 2rem + 18vw, 18rem) / 0.8 var(--font-display);
		text-transform: uppercase;
	}
	.cap {
		max-width: 28ch;
		font-size: var(--step-lead);
		line-height: 1.3;
	}
	.rest {
		display: grid;
		gap: var(--s-5);
		padding-block: var(--s-6) 0;
	}
	.rest li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--s-4);
		align-items: baseline;
	}
	.rest strong {
		font: 700 clamp(2.4rem, 1.8rem + 2vw, 3.4rem) / 1 var(--font-display);
		text-transform: uppercase;
		min-width: 7ch;
	}
	@media (min-width: 56rem) {
		.inside {
			flex-direction: column-reverse;
			justify-content: space-between;
			gap: var(--s-6);
		}
		.big {
			grid-template-columns: auto auto;
			justify-content: space-between;
			align-items: end;
		}
		.rest {
			grid-template-columns: repeat(3, 1fr);
			padding-top: var(--s-6);
		}
	}
	/* C */
	.table {
		display: grid;
		gap: var(--s-6) var(--s-5);
		grid-template-columns: 1fr 1fr;
	}
	.table li {
		display: grid;
		gap: var(--s-1);
		align-content: start;
	}
	.table strong {
		font: 700 clamp(3rem, 2rem + 4vw, 5.5rem) / 0.9 var(--font-display);
		color: var(--apricot);
		text-transform: uppercase;
	}
	@media (min-width: 56rem) {
		.table {
			grid-template-columns: repeat(4, 1fr);
		}
	}
</style>
