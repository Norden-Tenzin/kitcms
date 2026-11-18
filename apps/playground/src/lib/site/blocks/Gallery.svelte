<script lang="ts">
	// A grid of pictures that open in a viewer (keyboard: Enter or Space opens, arrows move, Escape closes).
	// A: three even columns. B: the first picture large, the rest in a grid. C: one row of tall crops.
	import type { DesignId } from '../designs';
	import Img from '../Img.svelte';
	import Lightbox from '../Lightbox.svelte';
	import { asMediaList } from '../media';
	import { reveal } from '../reveal';
	import SectionHead from './SectionHead.svelte';
	import type { BlockOf } from '../types';

	let { block, design = 'a' }: { block: BlockOf<'gallery'>; design?: DesignId } = $props();
	const images = $derived(asMediaList(block.images));
	let open = $state<number | null>(null);
</script>

{#if images.length}
	<section class="blk section" data-design={design}>
		<div class="container">
			<SectionHead heading={block.heading} />
			<ul>
				{#each images as image, i (image.id)}
					<li class={['reveal', design === 'b' && i === 0 && 'big']} use:reveal style:--i={i % 3}>
						<button type="button" onclick={() => (open = i)} aria-label={`Open picture ${i + 1} of ${images.length}${image.alt ? `: ${image.alt}` : ''}`}>
							<Img
								media={image}
								ratio={design === 'c' ? 3 / 4 : design === 'b' && i === 0 ? 16 / 10 : 4 / 3}
								widths={[480, 800, 1200]}
								sizes="(min-width: 56rem) 33vw, 100vw"
								alt=""
							/>
						</button>
					</li>
				{/each}
			</ul>
		</div>
		<Lightbox {images} bind:index={open} label={block.heading || 'Photographs'} />
	</section>
{/if}

<style>
	ul {
		list-style: none;
		display: grid;
		gap: var(--s-2);
		grid-template-columns: 1fr 1fr;
	}
	li {
		min-width: 0;
	}
	button {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: var(--surface-2);
		cursor: zoom-in;
		overflow: hidden;
	}
	button :global(img) {
		width: 100%;
		transition: transform 0.5s var(--ease);
	}
	button:hover :global(img) {
		transform: scale(1.03);
	}
	.big {
		grid-column: 1 / -1;
	}
	@media (min-width: 56rem) {
		ul {
			gap: var(--s-3);
		}
		[data-design='a'] ul {
			grid-template-columns: repeat(3, 1fr);
		}
		[data-design='b'] ul {
			grid-template-columns: repeat(3, 1fr);
		}
		[data-design='b'] .big {
			grid-column: span 2;
			grid-row: span 2;
		}
		[data-design='b'] .big button,
		[data-design='b'] .big :global(img) {
			height: 100%;
			object-fit: cover;
		}
		[data-design='c'] ul {
			grid-template-columns: repeat(4, 1fr);
		}
		[data-design='c'] li:nth-child(even) {
			margin-top: var(--s-5);
		}
	}
</style>
