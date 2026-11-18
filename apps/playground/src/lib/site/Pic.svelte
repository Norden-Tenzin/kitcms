<script lang="ts">
	// A picture in a fixed frame: the frame keeps its shape (and its tone) even before the image loads
	// or when a document has no picture yet. The one place that crops, so every design crops alike.
	import Img from './Img.svelte';
	import type { Media } from './media';

	interface Props {
		media: Media | null | undefined;
		/** width / height of the frame. */
		ratio?: number;
		sizes?: string;
		widths?: number[];
		eager?: boolean;
		alt?: string;
		class?: string;
		/** Fill the parent instead of using a ratio (parent must have a size). */
		fill?: boolean;
	}
	let { media, ratio = 4 / 3, sizes = '100vw', widths, eager = false, alt, class: className, fill = false }: Props = $props();
</script>

<div class={['pic', fill && 'fill', className]} style:aspect-ratio={fill ? undefined : ratio}>
	{#if media}<Img {media} {sizes} {widths} {eager} {alt} fit="cover" />{/if}
</div>

<style>
	.pic {
		position: relative;
		overflow: hidden;
		background: var(--surface);
		border-radius: var(--radius);
		width: 100%;
	}
	.pic.fill {
		height: 100%;
	}
</style>
