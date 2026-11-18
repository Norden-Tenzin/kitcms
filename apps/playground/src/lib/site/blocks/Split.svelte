<script lang="ts">
	// Picture and text. A uneven: a tall picture and an offset column. B flush: half a screen of
	// photograph against an earth field. C a calm card pair.
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import { asMedia } from '../media';
	import { reveal } from '../reveal';
	import type { BlockProps } from './props';

	let { block, design = 'a' }: BlockProps<'split'> = $props();
	const image = $derived(asMedia(block.image));
	const right = $derived(block.imageSide === 'right');
</script>

{#snippet copy()}
	{#if block.heading}<h2>{block.heading}</h2>{/if}
	<RichText doc={block.text} />
	{#if block.ctaLabel && block.ctaHref}<Link href={block.ctaHref} class="btn">{block.ctaLabel}</Link>{/if}
{/snippet}

{#if design === 'b'}
	<Section tone="earth" bleed pad="none">
		<div class="b" class:right>
			<Pic media={image} fill widths={[600, 1000, 1600]} sizes="(min-width: 56rem) 50vw, 100vw" class="photo" />
			<div class="copy">{@render copy()}</div>
		</div>
	</Section>
{:else if design === 'c'}
	<Section tone="surface">
		<div class="c" class:right>
			<div class="copy">{@render copy()}</div>
			<Pic media={image} ratio={4 / 3} sizes="(min-width: 56rem) 45vw, 100vw" />
		</div>
	</Section>
{:else}
	<Section>
		<div class="a" class:right>
			<div class="pic reveal" use:reveal><Pic media={image} ratio={4 / 5} sizes="(min-width: 56rem) 45vw, 100vw" /></div>
			<div class="copy reveal" use:reveal style:--i={1}>{@render copy()}</div>
		</div>
	</Section>
{/if}

<style>
	.copy {
		display: grid;
		gap: var(--s-4);
		justify-items: start;
		align-content: center;
	}
	.a,
	.c {
		display: grid;
		gap: var(--s-6);
	}
	.b {
		display: grid;
	}
	.b .copy {
		padding: var(--s-7) var(--gutter);
	}
	.b :global(.photo) {
		min-height: 55svh;
		border-radius: 0;
	}
	@media (min-width: 56rem) {
		.a {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-6);
			align-items: start;
		}
		.a .pic {
			grid-column: 1 / 7;
		}
		.a .copy {
			grid-column: 8 / 13;
			padding-top: var(--s-8, 6rem);
		}
		.a.right .pic {
			grid-column: 7 / 13;
			grid-row: 1;
		}
		.a.right .copy {
			grid-column: 1 / 6;
			grid-row: 1;
		}
		.b {
			grid-template-columns: 1fr 1fr;
			min-height: 80svh;
		}
		.b.right :global(.photo) {
			order: 2;
		}
		.b .copy {
			padding: var(--section) var(--s-7);
		}
		.c {
			grid-template-columns: 1fr 1fr;
			align-items: center;
			gap: var(--s-7);
		}
		.c.right .copy {
			order: 2;
		}
	}
</style>
