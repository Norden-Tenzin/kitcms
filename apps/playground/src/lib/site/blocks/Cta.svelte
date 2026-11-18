<script lang="ts">
	// Call to action. A a statement and a picture. B the photograph with one solid card. C a green field.
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import Section from '../Section.svelte';
	import { asMedia } from '../media';
	import type { BlockProps } from './props';

	let { block, design = 'a' }: BlockProps<'cta'> = $props();
	const image = $derived(asMedia(block.image));
</script>

{#snippet action()}
	{#if block.label && block.href}<Link href={block.href} class={design === 'c' ? 'btn light' : 'btn'}>{block.label}</Link>{/if}
{/snippet}

{#if design === 'b'}
	<Section bleed pad="none" class="b">
		<div class="stage">
			<Pic media={image} fill widths={[800, 1400, 2000]} sizes="100vw" class="bg" />
			<div class="container">
				<div class="card">
					<h2>{block.heading}</h2>
					{#if block.text}<p>{block.text}</p>{/if}
					{@render action()}
				</div>
			</div>
		</div>
	</Section>
{:else if design === 'c'}
	<Section tone="accent">
		<div class="c">
			<h2>{block.heading}</h2>
			<div class="side">
				{#if block.text}<p class="lead">{block.text}</p>{/if}
				{@render action()}
			</div>
		</div>
	</Section>
{:else}
	<Section>
		<div class="a">
			<div class="copy">
				<h2>{block.heading}</h2>
				{#if block.text}<p class="lead">{block.text}</p>{/if}
				{@render action()}
			</div>
			{#if image}<Pic media={image} ratio={1} sizes="(min-width: 56rem) 30vw, 70vw" class="sq" />{/if}
		</div>
	</Section>
{/if}

<style>
	.a {
		display: grid;
		gap: var(--s-6);
		align-items: end;
	}
	.copy,
	.side {
		display: grid;
		gap: var(--s-5);
		justify-items: start;
	}
	.a :global(.sq) {
		max-width: 20rem;
	}
	.stage {
		position: relative;
		min-height: 90svh;
		display: grid;
		align-items: center;
		isolation: isolate;
		padding-block: var(--s-7);
	}
	.stage :global(.bg) {
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: 0;
	}
	.card {
		background: var(--bg);
		color: var(--ink);
		padding: var(--s-6);
		border-radius: var(--radius);
		max-width: 26rem;
		display: grid;
		gap: var(--s-4);
		justify-items: start;
		margin-left: auto;
	}
	.card h2 {
		font-size: clamp(2.2rem, 1.6rem + 2vw, 3rem);
	}
	.c {
		display: grid;
		gap: var(--s-6);
	}
	@media (min-width: 56rem) {
		.a {
			grid-template-columns: 1fr auto;
			gap: var(--s-7);
		}
		.a h2 {
			max-width: 14ch;
		}
		.c {
			grid-template-columns: 7fr 5fr;
			align-items: end;
			gap: var(--s-7);
		}
		.c h2 {
			font-size: clamp(3.5rem, 1rem + 5vw, 6rem);
		}
	}
</style>
