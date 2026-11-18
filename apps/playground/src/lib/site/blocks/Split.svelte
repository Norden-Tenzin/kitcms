<script lang="ts">
	// Picture and text. A: even halves, a portrait crop. B: the picture runs to the page edge, text on a
	// tint. C: a small square picture beside large, closely set text.
	import type { RichTextDoc } from '@kitcms/core';
	import type { DesignId } from '../designs';
	import Link from '../Link.svelte';
	import { asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import RichText from '../RichText.svelte';
	import type { BlockOf } from '../types';

	let { block, design = 'a' }: { block: BlockOf<'split'>; design?: DesignId } = $props();
	const image = $derived(asMedia(block.image));
	const right = $derived(block.imageSide === 'right');
	const ratio = $derived(design === 'a' ? 4 / 5 : design === 'b' ? 1 : 1);
</script>

<section class={['blk section', design === 'b' && 'surface']} class:right data-design={design}>
	<div class={['wrap', design !== 'b' && 'container']}>
		<div class={['grid', design === 'b' && 'container']}>
			{#if image}
				<div class="pic reveal" use:reveal>
					<Pic media={image} {ratio} widths={[480, 800, 1200]} sizes="(min-width: 56rem) 45vw, 100vw" />
				</div>
			{/if}
			<div class="copy reveal" use:reveal style:--i={1}>
				{#if block.heading}<h2>{block.heading}</h2>{/if}
				<RichText doc={block.text as RichTextDoc | null | undefined} />
				{#if block.ctaLabel && block.ctaHref}<Link href={block.ctaHref} class="btn ghost">{block.ctaLabel}</Link>{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.grid {
		display: grid;
		gap: var(--s-5);
		align-items: center;
	}
	.copy {
		display: grid;
		gap: var(--s-3);
		justify-items: start;
	}
	[data-design='c'] .copy :global(.prose) {
		font-size: var(--step-lead);
		line-height: 1.45;
	}
	@media (min-width: 56rem) {
		.grid {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-7);
		}
		.right .pic {
			order: 2;
		}
		[data-design='c'] .grid {
			grid-template-columns: 4fr 8fr;
		}
		[data-design='c'].right .grid {
			grid-template-columns: 8fr 4fr;
		}
		[data-design='b'].blk {
			padding-block: 0;
		}
		[data-design='b'] .grid {
			gap: 0;
			align-items: stretch;
			max-width: none;
			padding-inline: 0;
		}
		[data-design='b'] .pic,
		[data-design='b'] .pic :global(.pic) {
			height: 100%;
			aspect-ratio: auto !important;
		}
		[data-design='b'] .copy {
			align-content: center;
			padding: var(--section) var(--gutter);
			max-width: 42rem;
		}
	}
</style>
