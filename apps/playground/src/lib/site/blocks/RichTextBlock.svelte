<script lang="ts">
	// A: heading left, text right. B: one centred reading column on a tint. C: heading above, text in a wide measure.
	import type { DesignId } from '../designs';
	import { reveal } from '../reveal';
	import RichText from '../RichText.svelte';
	import type { BlockOf } from '../types';
	import type { RichTextDoc } from '@kitcms/core';

	let { block, design = 'a' }: { block: BlockOf<'richText'>; design?: DesignId } = $props();
</script>

<section class={['blk section', design === 'b' && 'surface']} data-design={design}>
	<div class="container grid reveal" use:reveal>
		{#if block.heading}<h2>{block.heading}</h2>{/if}
		<RichText doc={block.body as RichTextDoc | null | undefined} />
	</div>
</section>

<style>
	.grid {
		display: grid;
		gap: var(--s-4);
	}
	h2 {
		max-width: 14ch;
	}
	[data-design='b'] .grid {
		max-width: 52rem;
	}
	@media (min-width: 56rem) {
		[data-design='a'] .grid {
			grid-template-columns: 5fr 7fr;
			gap: var(--s-7);
		}
		[data-design='c'] .grid :global(.prose) {
			max-width: 48rem;
			font-size: var(--step-lead);
			line-height: 1.5;
		}
	}
</style>
