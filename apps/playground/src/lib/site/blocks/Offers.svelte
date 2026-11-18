<script lang="ts">
	// Offers from the `offers` collection, which sits behind the `offers` add-on. `offers` is `null`
	// while the add-on is off (the Local API denied the read, see `content.ts`), so the block renders
	// nothing, and an empty list renders nothing too. In the admin preview (`undefined`) a note shows.
	import type { DesignId } from '../designs';
	import { formatDate } from '../format';
	import Link from '../Link.svelte';
	import { reveal } from '../reveal';
	import Placeholder from './Placeholder.svelte';
	import SectionHead from './SectionHead.svelte';
	import type { BlockOf, Offer } from '../types';

	let { block, offers, design = 'a' }: { block: BlockOf<'offers'>; offers?: Offer[] | null; design?: DesignId } = $props();
</script>

{#if offers === undefined}
	<Placeholder title={block.heading || 'Offers'} text="Shows the Offers collection. Hidden on the site while the Offers add-on is off." />
{:else if offers && offers.length}
	<section class={['blk section', design !== 'c' && 'surface']} data-design={design}>
		<div class="container">
			<SectionHead heading={block.heading} />
			<ul>
				{#each offers as o, i (o.id)}
					<li class="reveal" use:reveal style:--i={i}>
						<h3>{o.title}</h3>
						{#if o.price}<p class="price">{o.price}</p>{/if}
						{#if o.summary}<p class="muted">{o.summary}</p>{/if}
						{#if o.includes?.length}
							<ul class="inc">
								{#each o.includes as inc, j (inc.id ?? j)}<li>{inc.label}</li>{/each}
							</ul>
						{/if}
						{#if o.validTo}<p class="small muted">Until {formatDate(o.validTo)}</p>{/if}
						{#if o.ctaLabel && o.ctaHref}<Link href={o.ctaHref} class="btn ghost">{o.ctaLabel}</Link>{/if}
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<style>
	ul {
		list-style: none;
		display: grid;
		gap: var(--s-3);
	}
	li {
		display: grid;
		gap: var(--s-2);
		align-content: start;
		justify-items: start;
		padding: var(--s-4);
		background: var(--bg);
	}
	[data-design='c'] li {
		background: var(--surface);
	}
	.price {
		font: var(--step-h3) / 1 var(--font-display);
		color: var(--accent);
	}
	.inc {
		gap: 0.25rem;
		margin-block: var(--s-2);
	}
	.inc li {
		display: list-item;
		list-style: '+ ';
		padding: 0;
		background: none;
		margin-left: 1.2em;
	}
	@media (min-width: 56rem) {
		ul:not(.inc) {
			grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
			gap: var(--s-4);
		}
	}
</style>
