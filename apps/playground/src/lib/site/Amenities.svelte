<script lang="ts">
	import Icon from './Icon.svelte';

	let { items, columns = 2 }: { items: { id?: string; label: string; icon?: string | null }[]; columns?: number } = $props();
</script>

<ul style:--cols={columns}>
	{#each items as a, i (a.id ?? i)}
		<li>
			{#if a.icon}<Icon name={a.icon} size={26} />{:else}<Icon name="check" size={26} />{/if}
			<span>{a.label}</span>
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-3) var(--s-5);
		grid-template-columns: 1fr;
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		min-height: 2.75rem;
	}
	li :global(svg) {
		flex: none;
		color: var(--accent);
	}
	@media (min-width: 40rem) {
		ul {
			grid-template-columns: repeat(var(--cols), 1fr);
		}
	}
</style>
