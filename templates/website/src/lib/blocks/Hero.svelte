<script lang="ts">
	import '../site.css';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import { asMedia } from '../media';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'hero'> } = $props();
	const image = $derived(asMedia(block.image));
</script>

<section class="hero" class:with-image={image}>
	{#if image}
		<Img media={image} widths={[800, 1400, 2200]} sizes="100vw" class="bg" eager />
	{/if}
	<div class="container inner">
		<h1>{block.heading ?? ''}</h1>
		{#if block.subheading}<p class="sub">{block.subheading}</p>{/if}
		{#if block.ctaLabel && block.ctaHref}
			<Link href={block.ctaHref} class="btn">{block.ctaLabel}</Link>
		{/if}
	</div>
</section>

<style>
	.hero {
		position: relative;
		overflow: hidden;
		padding-block: clamp(3.5rem, 10vw, 8rem);
		background: var(--site-surface, #fff);
		border-bottom: 1px solid var(--site-border, #e4e0d8);
	}
	.hero.with-image {
		color: #fff;
		border-bottom: 0;
	}
	.hero :global(.bg) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: 0;
	}
	.hero.with-image::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(0 0 0 / 0.65), rgb(0 0 0 / 0.25));
		z-index: 1;
	}
	.inner {
		position: relative;
		z-index: 2;
	}
	h1 {
		font-size: clamp(2.2rem, 6vw, 4rem);
		max-width: 18ch;
	}
	.sub {
		max-width: 38rem;
		font-size: 1.2rem;
		margin: 0 0 1.5rem;
		opacity: 0.85;
	}
</style>
