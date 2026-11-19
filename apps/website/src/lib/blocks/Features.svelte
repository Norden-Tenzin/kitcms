<script lang="ts">
	import '../site.css';
	import Icon from '../Icon.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'features'> } = $props();
</script>

<section class="section">
	<div class="container">
		{#if block.title}<h2>{block.title}</h2>{/if}
		{#if block.intro}<p class="lead intro">{block.intro}</p>{/if}
		<ul class="grid">
			{#each block.items ?? [] as item, i (item?.id ?? i)}
				<li>
					<span class="icon"><Icon name={item?.icon} /></span>
					<h3>{item?.title ?? ''}</h3>
					{#if item?.text}<p class="muted">{item.text}</p>{/if}
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.intro {
		max-width: var(--measure);
	}
	.grid {
		display: grid;
		gap: 1.5rem;
		margin: 2rem 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		padding: 1.25rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}
	.icon {
		display: inline-flex;
		margin-bottom: 0.75rem;
		color: var(--accent);
	}
	@media (min-width: 40rem) {
		.grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
