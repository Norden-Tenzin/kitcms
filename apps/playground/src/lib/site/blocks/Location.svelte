<script lang="ts">
	// Where we are. A picture and text with a directions list. B the place with one solid visit card.
	// C a plain two-column table of directions beside the address.
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import { asMedia } from '../media';
	import { telHref } from '../shell';
	import type { BlockProps } from './props';

	let { block, design = 'a', extras }: BlockProps<'location'> = $props();
	const image = $derived(asMedia(block.image));
	const dirs = $derived(block.directions ?? []);
	const site = $derived(extras?.site);
	const phone = $derived(site?.contact?.phone ?? '');
	const address = $derived(site?.contact?.address ?? '');
	const mapUrl = $derived(site?.contact?.mapUrl ?? '');
</script>

{#snippet directions()}
	<dl>
		{#each dirs as d, i (d.id ?? i)}
			<div><dt>{d.label}</dt><dd>{d.text}</dd></div>
		{/each}
	</dl>
{/snippet}

{#if design === 'b'}
	<Section bleed pad="none">
		<div class="stage">
			<Pic media={image} fill widths={[800, 1400, 2000]} sizes="100vw" class="bg" />
			<div class="container">
				<div class="card">
					<h2>{block.heading ?? 'Find us'}</h2>
					{#if address}<address>{address}</address>{/if}
					{@render directions()}
					{#if phone}<Link class="link" href={telHref(phone)}>{phone}</Link>{/if}
					{#if mapUrl}<Link href={mapUrl} class="btn">Open the map</Link>{/if}
				</div>
			</div>
		</div>
	</Section>
{:else if design === 'c'}
	<Section tone="surface">
		<div class="c">
			<div class="head">
				<h2>{block.heading ?? 'Find us'}</h2>
				<RichText doc={block.text} />
				{#if address}<address>{address}</address>{/if}
				{#if mapUrl}<Link href={mapUrl} class="btn">Open the map</Link>{/if}
			</div>
			{@render directions()}
		</div>
	</Section>
{:else}
	<Section>
		<div class="a">
			<Pic media={image} ratio={4 / 5} sizes="(min-width: 56rem) 45vw, 100vw" />
			<div class="copy">
				<h2>{block.heading ?? 'Find us'}</h2>
				<RichText doc={block.text} />
				{@render directions()}
				{#if mapUrl}<Link href={mapUrl} class="btn">Open the map</Link>{/if}
			</div>
		</div>
	</Section>
{/if}

<style>
	.a,
	.c {
		display: grid;
		gap: var(--s-6);
	}
	.copy,
	.head {
		display: grid;
		gap: var(--s-4);
		justify-items: start;
		align-content: start;
	}
	address {
		font-style: normal;
		white-space: pre-line;
	}
	dl {
		display: grid;
		gap: var(--s-3);
		margin: 0;
		max-width: 44rem;
	}
	dl div {
		display: grid;
		gap: 0;
	}
	dt {
		font-weight: 600;
	}
	dd {
		margin: 0;
		color: var(--muted);
	}
	.stage {
		position: relative;
		min-height: 100svh;
		display: grid;
		align-items: center;
		padding-block: var(--s-7);
		isolation: isolate;
	}
	.stage :global(.bg) {
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: 0;
	}
	.card {
		background: var(--bg);
		padding: var(--s-6);
		border-radius: var(--radius);
		max-width: 28rem;
		display: grid;
		gap: var(--s-4);
		justify-items: start;
	}
	@media (min-width: 56rem) {
		.a {
			grid-template-columns: 5fr 6fr;
			gap: var(--s-7);
			align-items: center;
		}
		.c {
			grid-template-columns: 5fr 6fr;
			gap: var(--s-8, 6rem);
		}
		.card {
			margin-left: auto;
		}
	}
</style>
