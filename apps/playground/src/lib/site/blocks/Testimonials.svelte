<script lang="ts">
	// Guest words. A one big quotation, the others small beside it. B a scrolling row on slate.
	// C three cards on the surface tone.
	import Section from '../Section.svelte';
	import { reveal } from '../reveal';
	import type { BlockProps } from './props';

	let { block, design = 'a', extras }: BlockProps<'testimonials'> = $props();
	const items = $derived((extras?.testimonials ?? []).slice(0, block.count ?? 3));
	const first = $derived(items[0]);
	const rest = $derived(items.slice(1));
</script>

{#snippet who(t: (typeof items)[number])}
	<footer>
		<strong>{t.name}</strong>
		<span class="small">{[t.from, t.stayedIn].filter(Boolean).join(', ')}</span>
		<span class="small">{t.rating} out of 5</span>
	</footer>
{/snippet}

{#if design === 'b'}
	<Section tone="slate" bleed>
		<div class="container"><h2>{block.heading ?? 'Guests write'}</h2></div>
		<ul class="row">
			{#each items as t (t.id)}
				<li>
					<blockquote><p>{t.quote}</p>{@render who(t)}</blockquote>
				</li>
			{/each}
		</ul>
	</Section>
{:else if design === 'c'}
	<Section tone="surface">
		<h2 class="h">{block.heading ?? 'Guests write'}</h2>
		<ul class="cards">
			{#each items as t, i (t.id)}
				<li class="reveal" use:reveal style:--i={i}>
					<blockquote><p>{t.quote}</p>{@render who(t)}</blockquote>
				</li>
			{/each}
		</ul>
	</Section>
{:else}
	<Section>
		{#if first}
			<div class="a">
				<blockquote class="big reveal" use:reveal>
					<p>{first.quote}</p>
					{@render who(first)}
				</blockquote>
				<ul class="side">
					{#each rest as t, i (t.id)}
						<li class="reveal" use:reveal style:--i={i + 1}>
							<blockquote><p>{t.quote}</p>{@render who(t)}</blockquote>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</Section>
{/if}

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	blockquote {
		margin: 0;
		display: grid;
		gap: var(--s-4);
		align-content: start;
	}
	footer {
		display: grid;
		gap: 0;
	}
	.h {
		margin-bottom: var(--s-6);
	}
	/* A */
	.a {
		display: grid;
		gap: var(--s-7);
	}
	.big p {
		font: 600 clamp(1.9rem, 1.2rem + 2.4vw, 3.2rem) / 1.12 var(--font-display);
		max-width: 22ch;
	}
	.side {
		display: grid;
		gap: var(--s-6);
	}
	@media (min-width: 56rem) {
		.a {
			grid-template-columns: 7fr 4fr;
			gap: var(--s-8, 6rem);
		}
		.side {
			padding-top: var(--s-8, 6rem);
		}
	}
	/* B */
	.row {
		display: flex;
		gap: var(--s-6);
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		padding: var(--s-6) var(--gutter) 0;
	}
	.row::-webkit-scrollbar {
		display: none;
	}
	.row li {
		flex: none;
		width: min(86vw, 30rem);
		scroll-snap-align: start;
		scroll-margin-left: var(--gutter);
	}
	.row p {
		font-size: var(--step-lead);
		line-height: 1.35;
	}
	/* C */
	.cards {
		display: grid;
		gap: var(--s-5);
	}
	.cards li {
		background: var(--bg);
		padding: var(--s-5);
		border-radius: var(--radius);
	}
	@media (min-width: 56rem) {
		.cards {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
