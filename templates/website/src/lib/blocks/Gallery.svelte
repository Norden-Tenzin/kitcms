<script lang="ts">
	import '../site.css';
	import Img from '../Img.svelte';
	import { asMediaList } from '../media';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'gallery'> } = $props();
	const images = $derived(asMediaList(block.images));
</script>

<section class="section">
	<div class="container">
		{#if images.length}
			<ul class="grid">
				{#each images as media (media.id)}
					<li>
						<Img
							{media}
							ratio={4 / 3}
							widths={[400, 800, 1200]}
							sizes="(min-width: 48rem) 33vw, 100vw"
						/>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="placeholder">Gallery: add images to see them here.</p>
		{/if}
	</div>
</section>

<style>
	.section {
		padding-block: clamp(2rem, 5vw, 3.5rem);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
	}
	li :global(img) {
		width: 100%;
		object-fit: cover;
		border-radius: var(--site-radius, 0.75rem);
	}
</style>
