<script lang="ts">
	// A: an ink band, heading left, text and button right. B: a photograph with the heading on it.
	// C: an accent field with a very large heading.
	import type { DesignId } from '../designs';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import { asMedia } from '../media';
	import { reveal } from '../reveal';
	import type { BlockOf } from '../types';

	let { block, design = 'a' }: { block: BlockOf<'cta'>; design?: DesignId } = $props();
	const image = $derived(asMedia(block.image));
	const onPhoto = $derived(design === 'b' && Boolean(image));
	const has = $derived(Boolean(block.label && block.href));
</script>

<section class={['blk section', design === 'a' && 'inverse', design === 'b' && !image && 'inverse', design === 'c' && 'accent-field', onPhoto && 'photo']} data-design={design}>
	{#if onPhoto}<div class="bg"><Img media={image} fit="cover" widths={[800, 1400, 1600]} alt="" /></div>{/if}
	<div class="container grid reveal" use:reveal>
		<h2>{block.heading ?? ''}</h2>
		<div class="copy">
			{#if block.text}<p class="lead">{block.text}</p>{/if}
			{#if has}<Link href={block.href} class="btn light">{block.label}</Link>{/if}
		</div>
	</div>
</section>

<style>
	.blk {
		position: relative;
	}
	.photo {
		color: #fff;
		background: #26282a;
		--focus: #fff;
		--muted: rgb(255 255 255 / 0.9);
	}
	.bg {
		position: absolute;
		inset: 0;
	}
	.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: rgb(0 0 0 / 0.52);
	}
	.grid {
		position: relative;
		z-index: 1;
		display: grid;
		gap: var(--s-4);
	}
	.copy {
		display: grid;
		gap: var(--s-4);
		justify-items: start;
		align-content: start;
	}
	[data-design='c'] h2 {
		font-size: clamp(3rem, 1rem + 8vw, 9rem);
		line-height: 0.92;
	}
	[data-design='b'] h2 {
		max-width: 14ch;
	}
	@media (min-width: 56rem) {
		[data-design='a'] .grid {
			grid-template-columns: 7fr 5fr;
			align-items: end;
			gap: var(--s-7);
		}
		[data-design='c'] .grid {
			grid-template-columns: 1fr;
		}
	}
</style>
