<script lang="ts">
	// The services, from the `services` collection (data loaded by the page, see `content.ts`).
	// A: large rows, title left, summary and price right. B: four tiles with a photograph.
	// C: a plain text index, title and price on one line.
	import type { DesignId } from '../designs';
	import Icon from '../Icon.svelte';
	import Link from '../Link.svelte';
	import { asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import Placeholder from './Placeholder.svelte';
	import SectionHead from './SectionHead.svelte';
	import type { BlockOf, Service } from '../types';

	let { block, services, design = 'a' }: { block: BlockOf<'servicesList'>; services?: Service[]; design?: DesignId } = $props();
</script>

{#if !services}
	<Placeholder title={block.heading || 'Services'} text="Lists every service from the Services collection." />
{:else if services.length}
	<section class={['blk section', design === 'b' && 'surface']} data-design={design}>
		<div class="container">
			<SectionHead heading={block.heading} intro={block.intro} />
			<ul>
				{#each services as s, i (s.id)}
					<li class="reveal" use:reveal style:--i={i}>
						<Link href={`/services/${s.slug}`} class="row">
							{#if design === 'b'}
								<Pic media={asMedia(s.cover)} ratio={4 / 5} widths={[400, 700]} sizes="(min-width: 56rem) 22vw, 50vw" />
							{/if}
							<span class="title">{s.title}</span>
							{#if design !== 'c' && s.summary}<span class="sum muted">{s.summary}</span>{/if}
							<span class="price">{s.priceFrom ?? ''}</span>
							{#if design === 'a'}<Icon name="arrow-up-right" size={26} />{/if}
						</Link>
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
		gap: var(--s-2);
	}
	li :global(.row) {
		display: grid;
		gap: var(--s-2);
		text-decoration: none;
	}
	.title {
		font: var(--step-h3) / 1.05 var(--font-display);
	}
	.price {
		font-weight: 600;
		font-size: var(--step-small);
	}

	/* A */
	[data-design='a'] li :global(.row) {
		padding: var(--s-4) var(--gutter);
		margin-inline: calc(var(--gutter) * -1);
		background: var(--surface);
		transition: background-color 0.2s var(--ease);
	}
	[data-design='a'] li :global(.row:hover) {
		background: var(--surface-2);
	}
	[data-design='a'] .title {
		font-size: clamp(2rem, 1.2rem + 3vw, 3.6rem);
	}
	[data-design='a'] li :global(svg) {
		display: none;
	}

	/* B */
	[data-design='b'] ul {
		grid-template-columns: 1fr 1fr;
		gap: var(--s-4) var(--s-3);
	}
	[data-design='b'] li :global(.row) {
		align-content: start;
		gap: var(--s-1);
	}
	[data-design='b'] .title {
		margin-top: var(--s-2);
		font-size: clamp(1.4rem, 1rem + 1.4vw, 2rem);
	}
	[data-design='b'] .sum {
		display: none;
	}

	/* C */
	[data-design='c'] li :global(.row) {
		grid-template-columns: 1fr auto;
		align-items: baseline;
		padding-block: var(--s-3);
		background: var(--surface);
		padding-inline: var(--gutter);
		margin-inline: calc(var(--gutter) * -1);
	}
	[data-design='c'] li:nth-child(even) :global(.row) {
		background: var(--surface-2);
	}
	[data-design='c'] .title {
		font-size: clamp(1.8rem, 1rem + 3vw, 3.2rem);
	}

	@media (min-width: 56rem) {
		[data-design='a'] li :global(.row) {
			grid-template-columns: 5fr 5fr 2fr;
			align-items: baseline;
			gap: var(--s-5);
			padding-block: var(--s-5);
		}
		[data-design='a'] .price {
			text-align: right;
		}
		[data-design='b'] ul {
			grid-template-columns: repeat(4, 1fr);
			gap: var(--s-3);
		}
	}
</style>
