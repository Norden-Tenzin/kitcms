<script lang="ts">
	import '../site.css';
	import Link from '../Link.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'requirements'> } = $props();
</script>

<section class="section">
	<div class="container">
		{#if block.title}<h2>{block.title}</h2>{/if}
		{#if block.intro}<p class="lead intro">{block.intro}</p>{/if}
		<ul class="list">
			{#each block.items ?? [] as item, i (item?.id ?? i)}
				<li>
					<h3>{item?.name ?? ''}</h3>
					{#if item?.why}<p class="muted">{item.why}</p>{/if}
					{#if item?.href}<Link href={item.href} class="more">Learn more</Link>{/if}
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.intro {
		max-width: var(--measure);
	}
	.list {
		display: grid;
		gap: 1rem;
		margin: 2rem 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		padding: 1.25rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}
	li :global(.more) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--accent);
	}
	@media (min-width: 48rem) {
		.list {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
