<script lang="ts">
	// Offers. A editorial stacks. B picture-led pairs. C ticket-style rows on the surface tone.
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import Section from '../Section.svelte';
	import { asMedia } from '../media';
	import { fmtDate } from '../format';
	import { reveal } from '../reveal';
	import type { BlockProps } from './props';

	let { block, design = 'a', extras }: BlockProps<'offers'> = $props();
	const offers = $derived(extras?.offers ?? []);
	const valid = (o: (typeof offers)[number]) =>
		o.validFrom || o.validTo ? `${fmtDate(o.validFrom, { day: 'numeric', month: 'short' })} to ${fmtDate(o.validTo, { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
</script>

{#if offers.length}
	<Section tone={design === 'c' ? 'surface' : 'bg'}>
		{#if block.heading}<h2 class="h">{block.heading}</h2>{/if}
		<ul class={design}>
			{#each offers as o, i (o.id)}
				<li class="reveal" use:reveal style:--i={i}>
					{#if design !== 'c'}<Pic media={asMedia(o.cover)} ratio={design === 'b' ? 3 / 2 : 4 / 3} sizes="(min-width: 56rem) 40vw, 100vw" />{/if}
					<div class="body">
						{#if valid(o)}<p class="small">{valid(o)}</p>{/if}
						<h3>{o.title}</h3>
						{#if o.summary}<p>{o.summary}</p>{/if}
						{#if o.terms}<p class="small">{o.terms}</p>{/if}
						{#if o.ctaLabel && o.ctaHref}<Link href={o.ctaHref} class="btn">{o.ctaLabel}</Link>{/if}
					</div>
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
		display: grid;
		gap: var(--s-7);
	}
	.h {
		margin-bottom: var(--s-6);
	}
	li {
		display: grid;
		gap: var(--s-4);
	}
	.body {
		display: grid;
		gap: var(--s-3);
		justify-items: start;
		align-content: center;
	}
	.c li {
		background: var(--bg);
		padding: var(--s-5);
		border-radius: var(--radius);
	}
	@media (min-width: 56rem) {
		.a li {
			grid-template-columns: 7fr 5fr;
			gap: var(--s-7);
			align-items: end;
		}
		.a li:nth-child(even) :global(.pic) {
			order: 2;
		}
		.b {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-6);
		}
		.c li {
			padding: var(--s-6);
		}
	}
</style>
