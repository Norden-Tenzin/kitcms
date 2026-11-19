<script lang="ts">
	import '../site.css';
	import Link from '../Link.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'requirements'> } = $props();
</script>

<section class="section requirements">
	<div class="container">
		<header>
			{#if block.title}<h2>{block.title}</h2>{/if}
			{#if block.intro}<p class="lead">{block.intro}</p>{/if}
		</header>
		<ul class="list">
			{#each block.items ?? [] as item, i (item?.id ?? i)}
				<li>
					<h3>{item?.name ?? ''}</h3>
					{#if item?.why}<p class="why">{item.why}</p>{/if}
					{#if item?.href}<Link href={item.href} class="more">Learn more</Link>{/if}
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.requirements {
		background: var(--surface);
	}
	header {
		margin-bottom: clamp(2rem, 1rem + 3vw, 3.5rem);
	}
	header :global(.lead) {
		max-width: 36rem;
	}
	.list {
		display: grid;
		gap: 2.5rem 3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	h3 {
		font-size: clamp(1.5rem, 1.1rem + 1.4vw, 2.2rem);
		letter-spacing: -0.03em;
	}
	.why {
		margin-bottom: 0.5rem;
		color: var(--muted);
	}
	li :global(.more) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--accent);
		font-weight: 650;
	}
	@media (min-width: 48rem) {
		.list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
