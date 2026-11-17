<script lang="ts">
	import type { BlockPreviewProps } from '@kitcms/ui';

	let { block }: BlockPreviewProps = $props();
	const items = $derived((block.items ?? []) as { id?: string; label?: string; icon?: string }[]);
</script>

<section class="features">
	{#if block.title}<h2>{block.title as string}</h2>{/if}
	<ul>
		{#each items as item, i (item.id ?? i)}
			<li><strong>{item.label}</strong>{#if item.icon} <small>({item.icon})</small>{/if}</li>
		{/each}
	</ul>
</section>

<style>
	.features {
		padding: 1.25rem;
	}
	h2 {
		margin: 0 0 0.5rem;
	}
	ul {
		display: grid;
		gap: 0.25rem;
		margin: 0;
		padding-left: 1.2rem;
	}
</style>
