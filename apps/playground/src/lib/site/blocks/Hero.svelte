<script lang="ts">
	// Hero. A "Courtyard": heading and a picture at uneven sizes. B "Panorama": the photograph is the
	// whole first screen. C "Ledger": a fixed photograph beside a calm column.
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import Img from '../Img.svelte';
	import { asMedia } from '../media';
	import { seasonStatus } from '../shell';
	import type { BlockProps } from './props';

	let { block, design = 'a' }: BlockProps<'hero'> = $props();
	const image = $derived(asMedia(block.image));
	const second = $derived(asMedia(block.secondImage));
	const status = seasonStatus();
</script>

{#if design === 'b'}
	<section class="b on-dark">
		<div class="photo">
			<Img media={image} eager fit="cover" widths={[800, 1400, 2000]} sizes="100vw" alt="" />
		</div>
		<div class="container inner">
			<h1>{block.heading}</h1>
			<div class="under">
				{#if block.subheading}<p class="lead">{block.subheading}</p>{/if}
				{#if block.ctaLabel && block.ctaHref}<Link href={block.ctaHref} class="btn">{block.ctaLabel}</Link>{/if}
			</div>
		</div>
	</section>
{:else if design === 'c'}
	<section class="c">
		<div class="text">
			<h1>{block.heading}</h1>
			{#if block.subheading}<p class="lead">{block.subheading}</p>{/if}
			<div class="actions">
				{#if block.ctaLabel && block.ctaHref}<Link href={block.ctaHref} class="btn">{block.ctaLabel}</Link>{/if}
				<p class="small"><span class="dot" class:open={status.open}></span>{status.text}</p>
			</div>
		</div>
		<div class="photo"><Pic media={image} fill eager widths={[700, 1100, 1600]} sizes="(min-width: 56rem) 50vw, 100vw" alt="" /></div>
	</section>
{:else}
	<section class="a container">
		<h1>{block.heading}</h1>
		<div class="grid">
			<div class="copy">
				{#if block.subheading}<p class="lead">{block.subheading}</p>{/if}
				{#if block.ctaLabel && block.ctaHref}<Link href={block.ctaHref} class="btn">{block.ctaLabel}</Link>{/if}
			</div>
			<Pic media={image} ratio={16 / 10} eager widths={[700, 1200, 1800]} sizes="(min-width: 56rem) 62vw, 100vw" class="main" alt="" />
			{#if second}<Pic media={second} ratio={4 / 5} sizes="(min-width: 56rem) 22vw, 50vw" class="small-pic" alt="" />{/if}
		</div>
	</section>
{/if}

<style>
	/* ----- A: Courtyard ----- */
	.a {
		padding-top: calc(var(--hdr-over) + var(--s-5));
	}
	.a h1 {
		font-size: clamp(2.6rem, 1rem + 9.6vw, 11rem);
		max-width: 16ch;
		position: relative;
		z-index: 1;
	}
	.grid {
		display: grid;
		gap: var(--s-5);
		margin-top: var(--s-5);
	}
	.copy {
		display: grid;
		gap: var(--s-5);
		justify-items: start;
	}
	.a :global(.small-pic) {
		width: 46%;
		margin-top: calc(var(--s-6) * -1);
		margin-left: var(--s-4);
	}
	@media (min-width: 56rem) {
		.a h1 {
			font-size: clamp(4.5rem, 1rem + 8.2vw, 10.5rem);
			max-width: 18ch;
		}
		.grid {
			grid-template-columns: repeat(12, 1fr);
			gap: 0 var(--s-5);
			margin-top: calc(var(--s-7) * -0.8);
		}
		.copy {
			grid-column: 1 / 5;
			grid-row: 1;
			align-self: end;
			padding-bottom: var(--s-6);
		}
		.a :global(.main) {
			grid-column: 5 / 13;
			grid-row: 1;
		}
		.a :global(.small-pic) {
			grid-column: 4 / 7;
			grid-row: 2;
			width: 100%;
			margin: calc(var(--s-7) * -1.4) 0 0;
			position: relative;
			outline: 10px solid var(--bg);
		}
	}

	/* ----- B: Panorama ----- */
	.b {
		position: relative;
		min-height: 100svh;
		display: grid;
		align-items: end;
		color: #fff;
		isolation: isolate;
	}
	.b .photo {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: var(--slate);
	}
	.b .photo :global(img) {
		animation: settle 1.4s var(--ease) both;
	}
	/* The neutral scrim sits under the text area only. */
	.b .photo::after {
		content: '';
		position: absolute;
		inset: 35% 0 0;
		background: linear-gradient(transparent, rgb(20 12 8 / 0.72));
	}
	@keyframes settle {
		from {
			transform: scale(1.12);
			clip-path: inset(0 0 12% 0);
		}
	}
	.inner {
		padding-block: var(--s-7) var(--s-6);
		display: grid;
		gap: var(--s-5);
	}
	.b h1 {
		font-size: clamp(2.8rem, 0.8rem + 10.5vw, 10rem);
		max-width: 20ch;
	}
	.under {
		display: grid;
		gap: var(--s-4);
		justify-items: start;
	}
	.b .lead {
		max-width: 34ch;
	}
	@media (min-width: 56rem) {
		.under {
			grid-template-columns: 1fr auto;
			align-items: end;
			gap: var(--s-6);
		}
		.inner {
			padding-bottom: var(--s-7);
		}
	}

	/* ----- C: Ledger ----- */
	.c {
		display: grid;
	}
	.c .text {
		display: grid;
		gap: var(--s-5);
		align-content: center;
		padding: calc(var(--hdr-over) + var(--s-6)) var(--gutter) var(--s-6);
		background: var(--surface);
		order: 2;
	}
	.c h1 {
		font-size: clamp(2.6rem, 1rem + 4.8vw, 5.5rem);
		max-width: 16ch;
	}
	.c .photo {
		order: 1;
		height: 62svh;
	}
	.actions {
		display: grid;
		gap: var(--s-4);
		justify-items: start;
	}
	.actions p {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.dot {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		background: var(--flag);
	}
	.dot.open {
		background: var(--accent);
	}
	@media (min-width: 56rem) {
		.c {
			grid-template-columns: 1fr 1fr;
			min-height: 100svh;
		}
		.c .text {
			order: 1;
			padding-inline: max(var(--gutter), calc((100vw - var(--max)) / 2 + var(--gutter))) var(--s-7);
		}
		.c .photo {
			order: 2;
			height: auto;
			min-height: 100svh;
			position: sticky;
			top: 0;
			align-self: start;
			height: 100svh;
		}
	}
</style>
