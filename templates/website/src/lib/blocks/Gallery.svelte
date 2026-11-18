<script lang="ts">
	import '../site.css';
	import type { DesignId } from '../designs';
	import Img from '../Img.svelte';
	import { asMediaList } from '../media';
	import type { BlockOf } from './types';

	// A "Editorial": pictures at uneven sizes on a 12-column grid. B "Immersive": an edge-to-edge
	// grid with hairline gaps. C "Structured": equal tiles with their captions.
	let { block, design = 'a' }: { block: BlockOf<'gallery'>; design?: DesignId } = $props();
	const images = $derived(asMediaList(block.images));
	// A: the shape of each picture, repeating.
	const RATIOS = [3 / 2, 4 / 5, 1, 3 / 2, 4 / 5, 3 / 2];
</script>

<section class="section" data-design={design}>
	<div class:container={design !== 'b'}>
		{#if images.length}
			<ul class="grid">
				{#each images as media, i (media.id)}
					<li>
						<figure>
							<Img
								{media}
								ratio={design === 'a' ? RATIOS[i % RATIOS.length] : design === 'b' ? 1 : 4 / 3}
								widths={[400, 800, 1200]}
								sizes={design === 'b'
									? '(min-width: 48rem) 33vw, 50vw'
									: '(min-width: 48rem) 40vw, 100vw'}
							/>
							{#if design === 'c' && media.alt}<figcaption class="small muted">{media.alt}</figcaption>{/if}
						</figure>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="placeholder container">Gallery: add images to see them here.</p>
		{/if}
	</div>
</section>

<style>
	.section {
		padding-block: var(--s-6);
	}
	.section[data-design='b'] {
		padding-block: 0;
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-2);
		grid-template-columns: 1fr;
	}
	figure {
		margin: 0;
	}
	li :global(img) {
		border-radius: var(--radius);
	}
	figcaption {
		margin-top: 0.4rem;
	}

	/* B */
	.section[data-design='b'] .grid {
		gap: 0.25rem;
		grid-template-columns: repeat(2, 1fr);
	}
	.section[data-design='b'] li :global(img) {
		border-radius: 0;
	}
	.section[data-design='b'] .placeholder {
		margin: var(--s-5) var(--gutter);
	}

	/* C */
	.section[data-design='c'] .grid {
		grid-template-columns: repeat(2, 1fr);
		gap: var(--s-3) var(--s-2);
	}
	.section[data-design='c'] li :global(img) {
		border-radius: 0.25rem;
	}

	@media (min-width: 48rem) {
		.section[data-design='a'] .grid {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-5) var(--s-4);
			align-items: start;
		}
		.section[data-design='a'] li {
			grid-column: span 6;
		}
		.section[data-design='a'] li:nth-child(4n + 1) {
			grid-column: 1 / span 7;
		}
		.section[data-design='a'] li:nth-child(4n + 2) {
			grid-column: 8 / span 5;
			margin-top: var(--s-6);
		}
		.section[data-design='a'] li:nth-child(4n + 3) {
			grid-column: 2 / span 5;
		}
		.section[data-design='a'] li:nth-child(4n) {
			grid-column: 7 / span 6;
		}
		.section[data-design='b'] .grid {
			grid-template-columns: repeat(3, 1fr);
		}
		.section[data-design='c'] .grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	@media (min-width: 72rem) {
		.section[data-design='c'] .grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}
</style>
