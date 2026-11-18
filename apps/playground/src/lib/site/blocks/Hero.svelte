<script lang="ts">
	// A "Editorial": the headline large on the left, a portrait photograph on the right.
	// B "Showcase": a full-bleed photograph with the headline on it (an accent field without a photo).
	// C "Studio index": a typographic opening, headline and text side by side, a wide strip photograph below.
	import type { DesignId } from '../designs';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import { asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import type { BlockOf } from '../types';

	let { block, design = 'a' }: { block: BlockOf<'hero'>; design?: DesignId } = $props();
	const image = $derived(asMedia(block.image));
	const hasCta = $derived(Boolean(block.ctaLabel && block.ctaHref));
</script>

{#if design === 'b'}
	<section class={['hero b', image ? 'photo' : 'accent-field']} data-design="b">
		{#if image}
			<div class="bg"><Img media={image} fit="cover" widths={[800, 1400, 1600]} sizes="100vw" eager alt="" /></div>
		{/if}
		<div class="container inner">
			<h1>{block.heading ?? ''}</h1>
			{#if block.subheading}<p class="lead">{block.subheading}</p>{/if}
			{#if hasCta}<Link href={block.ctaHref} class="btn light">{block.ctaLabel}</Link>{/if}
		</div>
	</section>
{:else if design === 'c'}
	<section class="hero c" data-design="c">
		<div class="container top">
			<h1>{block.heading ?? ''}</h1>
			<div class="side">
				{#if block.subheading}<p class="lead">{block.subheading}</p>{/if}
				{#if hasCta}<Link href={block.ctaHref} class="btn">{block.ctaLabel}</Link>{/if}
			</div>
		</div>
		{#if image}
			<div class="container strip"><Pic media={image} ratio={21 / 9} widths={[800, 1400, 1600]} sizes="(min-width: 84rem) 1300px, 100vw" eager /></div>
		{/if}
	</section>
{:else}
	<section class="hero a" data-design="a">
		<div class="container grid" class:solo={!image}>
			<div class="copy">
				<h1>{block.heading ?? ''}</h1>
				{#if block.subheading}<p class="lead">{block.subheading}</p>{/if}
				{#if hasCta}<Link href={block.ctaHref} class="btn">{block.ctaLabel}</Link>{/if}
			</div>
			{#if image}
				<div class="pic"><Pic media={image} ratio={4 / 5} widths={[480, 800, 1200]} sizes="(min-width: 56rem) 40vw, 100vw" eager /></div>
			{/if}
		</div>
	</section>
{/if}

<style>
	.hero {
		padding-block: var(--s-5) var(--section);
	}
	.lead {
		color: var(--muted);
	}
	.hero :global(.btn) {
		margin-top: var(--s-4);
	}

	/* A */
	.a .grid {
		display: grid;
		gap: var(--s-5);
	}
	.a h1 {
		max-width: 12ch;
	}
	.a .lead {
		margin-top: var(--s-4);
	}

	/* B */
	.b {
		position: relative;
		display: flex;
		align-items: flex-end;
		min-height: clamp(30rem, 82svh, 52rem);
		padding-block: var(--s-7) var(--s-6);
		overflow: hidden;
	}
	.b.photo {
		color: #fff;
		background: #26282a;
		--focus: #fff;
	}
	.b .bg {
		position: absolute;
		inset: 0;
	}
	/* A neutral scrim under text on a photograph, so the light type always reads. */
	.b.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(0 0 0 / 0.82), rgb(0 0 0 / 0.35) 55%, rgb(0 0 0 / 0.2));
	}
	.b .inner {
		position: relative;
		z-index: 1;
	}
	.b h1 {
		max-width: 13ch;
	}
	.b .lead {
		margin-top: var(--s-3);
		color: inherit;
		opacity: 0.92;
	}

	/* C */
	.c .top {
		display: grid;
		gap: var(--s-4);
		margin-bottom: var(--s-5);
	}
	.c h1 {
		font-size: clamp(3.2rem, 1rem + 9.6vw, 10.5rem);
		line-height: 0.88;
	}
	.c .side :global(.btn) {
		margin-top: var(--s-3);
	}

	@media (min-width: 56rem) {
		.a .grid:not(.solo) {
			grid-template-columns: 7fr 5fr;
			align-items: end;
			gap: var(--s-7);
		}
		.a .pic {
			margin-bottom: calc(var(--section) * -0.5);
		}
		.c .top {
			grid-template-columns: 8fr 4fr;
			align-items: end;
			gap: var(--s-6);
		}
	}
</style>
