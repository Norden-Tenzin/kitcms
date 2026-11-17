<script lang="ts">
	// Default preview: every block of every `blocks` field, in document order. Blocks without a
	// registered preview render as a labelled placeholder.
	import type { AdminPreviews } from './types';
	import type { BlockEntry } from './blocks';
	import LazyPreview from './LazyPreview.svelte';

	let {
		entries,
		loaders,
		doc,
	}: {
		entries: BlockEntry[];
		loaders: NonNullable<AdminPreviews['blocks']>;
		doc: Record<string, unknown>;
	} = $props();
</script>

{#each entries as entry (entry.key)}
	{@const loader = loaders[entry.block.blockType]}
	{#if loader}
		<LazyPreview {loader} props={{ block: entry.block, doc }} label={`${entry.label} preview`} />
	{:else}
		<div class="placeholder" data-testid="block-placeholder">{entry.label}</div>
	{/if}
{/each}

<style>
	.placeholder {
		padding: 0.75rem 1rem;
		margin: 0.5rem 0;
		border: 1px dashed var(--kc-border);
		border-radius: var(--kc-radius);
		color: var(--kc-muted);
		font: 13px/1.4 var(--kc-font);
	}
</style>
