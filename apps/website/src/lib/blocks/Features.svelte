<script lang="ts">
	import '../site.css';
	import Icon from '../Icon.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'features'> } = $props();
</script>

<section class="section features">
	<div class="container layout">
		<header>
			{#if block.title}<h2>{block.title}</h2>{/if}
			{#if block.intro}<p class="lead">{block.intro}</p>{/if}
		</header>
		<ul class="items">
			{#each block.items ?? [] as item, i (item?.id ?? i)}
				<li>
					<h3>
						<span class="icon"><Icon name={item?.icon} size={22} /></span>
						{item?.title ?? ''}
					</h3>
					{#if item?.text}<p class="text">{item.text}</p>{/if}
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.features {
		background: var(--surface);
	}
	.layout {
		display: grid;
		gap: 2.5rem;
	}
	header :global(.lead) {
		max-width: 28rem;
	}
	.items {
		display: grid;
		gap: 2.25rem 3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	h3 {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 0.4rem;
	}
	.icon {
		display: inline-flex;
		flex: none;
		align-self: center;
		color: var(--accent);
	}
	.text {
		margin: 0;
		color: var(--muted);
	}
	@media (min-width: 40rem) {
		.items {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 64rem) {
		.layout {
			grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
			gap: 4rem;
			align-items: start;
		}
		header {
			position: sticky;
			top: calc(var(--header-h) + 2rem);
		}
	}
</style>
