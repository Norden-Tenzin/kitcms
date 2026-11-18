<script lang="ts">
	import '../site.css';
	import type { DesignId } from '../designs';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import { asMedia } from '../media';
	import type { BlockOf } from './types';

	// A "Editorial": text left, a portrait picture right. B "Immersive": a full-bleed photograph
	// with the text on it (a field of the accent colour without a picture). C "Structured": a
	// tinted panel with the text beside a landscape picture.
	let { block, design = 'a' }: { block: BlockOf<'hero'>; design?: DesignId } = $props();
	const image = $derived(asMedia(block.image));
</script>

<section class="hero" data-design={design} class:photo={design === 'b' && image}>
	{#if design === 'b'}
		{#if image}
			<div class="bg"><Img media={image} fill widths={[800, 1400, 2200]} sizes="100vw" eager /></div>
		{/if}
		<div class="container inner">
			<h1>{block.heading ?? ''}</h1>
			{#if block.subheading}<p class="lead sub">{block.subheading}</p>{/if}
			{#if block.ctaLabel && block.ctaHref}
				<Link href={block.ctaHref} class={['btn', image ? 'on-photo' : 'inverse']}>{block.ctaLabel}</Link>
			{/if}
		</div>
	{:else}
		<div class="container grid" class:solo={!image}>
			<div class="copy">
				<h1>{block.heading ?? ''}</h1>
				{#if block.subheading}<p class="lead sub">{block.subheading}</p>{/if}
				{#if block.ctaLabel && block.ctaHref}
					<Link href={block.ctaHref} class="btn">{block.ctaLabel}</Link>
				{/if}
			</div>
			{#if image}
				<div class="pic">
					<Img
						media={image}
						ratio={design === 'a' ? 4 / 5 : 4 / 3}
						widths={[480, 800, 1200]}
						sizes="(min-width: 56rem) 40vw, 100vw"
						eager
					/>
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.hero {
		padding-block: var(--s-6) var(--s-6);
	}
	.sub {
		max-width: 36rem;
		margin-bottom: var(--s-4);
		color: var(--muted);
	}
	.grid {
		display: grid;
		gap: var(--s-5);
	}
	.pic :global(img) {
		border-radius: var(--radius);
	}

	/* A: editorial */
	.hero[data-design='a'] {
		--font-display: var(--font-serif);
		padding-block: var(--s-6) var(--s-7);
	}
	.hero[data-design='a'] h1 {
		font-weight: 600;
		font-size: clamp(2.5rem, 1.4rem + 4.4vw, 5rem);
		max-width: 14ch;
	}

	/* B: immersive */
	.hero[data-design='b'] {
		display: flex;
		align-items: flex-end;
		position: relative;
		min-height: clamp(22rem, 62svh, 38rem);
		padding-block: var(--s-7) var(--s-6);
		background: var(--accent);
		color: var(--accent-ink);
		--focus: var(--accent-ink);
		overflow: hidden;
	}
	.hero[data-design='b'].photo {
		min-height: clamp(30rem, 86svh, 54rem);
		color: #ffffff;
		--focus: #ffffff;
		background: #2a2c2e;
	}
	.bg {
		position: absolute;
		inset: 0;
	}
	.hero.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(0 0 0 / 0.78), rgb(0 0 0 / 0.1) 70%);
	}
	.hero[data-design='b'] .inner {
		position: relative;
		z-index: 1;
	}
	.hero[data-design='b'] h1 {
		max-width: 16ch;
	}
	.hero[data-design='b'] .sub {
		color: inherit;
		opacity: 0.92;
	}

	/* C: structured */
	.hero[data-design='c'] {
		background: var(--surface);
		padding-block: var(--s-6);
	}
	.hero[data-design='c'] h1 {
		font-size: clamp(2.25rem, 1.3rem + 3.6vw, 4rem);
		max-width: 16ch;
	}
	.solo .copy {
		max-width: 46rem;
	}

	@media (min-width: 56rem) {
		.hero[data-design='a'] .grid:not(.solo) {
			grid-template-columns: 7fr 5fr;
			align-items: end;
			gap: var(--s-7);
		}
		.hero[data-design='a'] .pic {
			margin-bottom: calc(var(--s-6) * -1);
		}
		.hero[data-design='c'] .grid:not(.solo) {
			grid-template-columns: 1fr 1fr;
			align-items: center;
			gap: var(--s-6);
		}
		.hero[data-design='c'] {
			padding-block: var(--s-7);
		}
	}
</style>
