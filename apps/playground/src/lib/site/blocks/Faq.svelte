<script lang="ts">
	// Questions. A heading beside an accordion. B the accordion beside a tall photograph. C grouped by
	// topic, two columns. All use native <details>: keyboard and screen readers work without script.
	import Pic from '../Pic.svelte';
	import Section from '../Section.svelte';
	import { asMedia } from '../media';
	import type { Faq } from '../types';
	import type { BlockProps } from './props';

	let { block, design = 'a', extras }: BlockProps<'faq'> = $props();
	const items = $derived((extras?.faqs ?? []).filter((f) => !block.category || f.category === block.category));
	const groups = $derived.by(() => {
		const m: Record<string, Faq[]> = {};
		for (const f of items) (m[f.category ?? 'General'] ??= []).push(f);
		return Object.entries(m);
	});
	const image = $derived(asMedia(block.image));
</script>

{#snippet qa(f: Faq)}
	<details>
		<summary><span>{f.question}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg></summary>
		<p>{f.answer}</p>
	</details>
{/snippet}

{#if design === 'c'}
	<Section tone="surface">
		<h2 class="h">{block.heading ?? 'Good to know'}</h2>
		<div class="groups">
			{#each groups as [name, list] (name)}
				<div>
					<h3>{name}</h3>
					{#each list as f (f.id)}{@render qa(f)}{/each}
				</div>
			{/each}
		</div>
	</Section>
{:else}
	<Section>
		<div class="split {design}">
			<div class="col">
				<h2>{block.heading ?? 'Good to know'}</h2>
				<div class="list">{#each items as f (f.id)}{@render qa(f)}{/each}</div>
			</div>
			{#if design === 'b'}<Pic media={image} ratio={3 / 4} sizes="(min-width: 56rem) 40vw, 100vw" class="tall" />{/if}
		</div>
	</Section>
{/if}

<style>
	.h {
		margin-bottom: var(--s-6);
	}
	.col {
		display: grid;
		gap: var(--s-6);
		align-content: start;
	}
	.list {
		display: grid;
		gap: var(--s-4);
	}
	details {
		padding-block: var(--s-1);
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-4);
		min-height: 2.75rem;
		font: 600 1.2rem/1.3 var(--font-text);
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary svg {
		flex: none;
		transition: transform 0.25s var(--ease);
	}
	details[open] summary svg {
		transform: rotate(180deg);
	}
	details p {
		padding: var(--s-2) 0 var(--s-3);
		max-width: 60ch;
		color: var(--muted);
	}
	.split {
		display: grid;
		gap: var(--s-6);
	}
	.groups {
		display: grid;
		gap: var(--s-6);
	}
	.groups h3 {
		margin-bottom: var(--s-3);
		color: var(--accent);
	}
	@media (min-width: 56rem) {
		.split.a {
			grid-template-columns: 4fr 7fr;
			gap: var(--s-7);
		}
		.split.a .col {
			display: contents;
		}
		.split.a .col h2 {
			grid-column: 1;
		}
		.split.a .list {
			grid-column: 2;
			grid-row: 1;
		}
		.split.b {
			grid-template-columns: 7fr 5fr;
			gap: var(--s-7);
			align-items: start;
		}
		.groups {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-6) var(--s-7);
		}
	}
</style>
