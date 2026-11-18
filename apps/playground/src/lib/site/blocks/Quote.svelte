<script lang="ts">
	// A pull quotation. A offset beside a small picture. B on a full-bleed photograph. C on the apricot-free earth field.
	import Pic from '../Pic.svelte';
	import Section from '../Section.svelte';
	import { asMedia } from '../media';
	import type { BlockProps } from './props';

	let { block, design = 'a' }: BlockProps<'quote'> = $props();
	const image = $derived(asMedia(block.image));
</script>

{#if design === 'b'}
	<Section bleed pad="none">
		<div class="stage on-dark">
			<Pic media={image} fill widths={[800, 1400, 2000]} sizes="100vw" class="bg" />
			<div class="container">
				<blockquote><p>{block.text}</p>{#if block.attribution}<footer>{block.attribution}</footer>{/if}</blockquote>
			</div>
		</div>
	</Section>
{:else if design === 'c'}
	<Section tone="earth">
		<blockquote class="c"><p>{block.text}</p>{#if block.attribution}<footer>{block.attribution}</footer>{/if}</blockquote>
	</Section>
{:else}
	<Section>
		<div class="a">
			<blockquote><p>{block.text}</p>{#if block.attribution}<footer class="small">{block.attribution}</footer>{/if}</blockquote>
			{#if image}<Pic media={image} ratio={1} sizes="(min-width: 56rem) 25vw, 60vw" class="sq" />{/if}
		</div>
	</Section>
{/if}

<style>
	blockquote {
		margin: 0;
		display: grid;
		gap: var(--s-4);
	}
	p {
		font: 600 clamp(2rem, 1.2rem + 3vw, 3.6rem) / 1.08 var(--font-display);
		max-width: 24ch;
	}
	footer {
		font-size: var(--step-lead);
	}
	.a {
		display: grid;
		gap: var(--s-6);
	}
	.a :global(.sq) {
		max-width: 16rem;
	}
	@media (min-width: 56rem) {
		.a {
			grid-template-columns: 7fr 3fr;
			align-items: end;
			gap: var(--s-8, 6rem);
		}
		.a blockquote {
			padding-bottom: var(--s-7);
		}
	}
	.stage {
		position: relative;
		min-height: 80svh;
		display: grid;
		align-items: end;
		padding-block: var(--s-7);
		color: #fff;
		isolation: isolate;
	}
	.stage :global(.bg) {
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: 0;
	}
	.stage::after {
		content: '';
		position: absolute;
		inset: 30% 0 0;
		z-index: -1;
		background: linear-gradient(transparent, rgb(20 12 8 / 0.75));
	}
	.c p {
		max-width: 28ch;
		font-size: clamp(2.2rem, 1.2rem + 4vw, 5rem);
	}
</style>
