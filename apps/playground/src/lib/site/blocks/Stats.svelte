<script lang="ts">
	// Key figures. A: large numerals on a tint. B: an accent field. C: an ink field, figures in one row.
	import type { DesignId } from '../designs';
	import { reveal } from '../reveal';
	import SectionHead from './SectionHead.svelte';
	import type { BlockOf } from '../types';

	let { block, design = 'a' }: { block: BlockOf<'stats'>; design?: DesignId } = $props();
	const items = $derived(block.items ?? []);
</script>

{#if items.length}
	<section class={['blk section', design === 'a' && 'surface', design === 'b' && 'accent-field', design === 'c' && 'inverse']} data-design={design}>
		<div class="container">
			<SectionHead heading={block.heading} />
			<dl>
				{#each items as item, i (item.id ?? i)}
					<div class="reveal" use:reveal style:--i={i}>
						<dt>{item.value}</dt>
						<dd>{item.label}</dd>
					</div>
				{/each}
			</dl>
		</div>
	</section>
{/if}

<style>
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-5) var(--s-3);
	}
	dt {
		font: clamp(2.8rem, 1.6rem + 5vw, 6.5rem) / 0.95 var(--font-display);
		letter-spacing: -0.02em;
		overflow-wrap: anywhere;
	}
	dd {
		margin: var(--s-2) 0 0;
		max-width: 16rem;
		color: var(--muted);
	}
	@media (min-width: 56rem) {
		dl {
			grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
			gap: var(--s-5);
		}
		[data-design='c'] dl {
			display: flex;
			justify-content: space-between;
		}
	}
</style>
