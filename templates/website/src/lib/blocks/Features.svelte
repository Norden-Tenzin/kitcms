<script lang="ts">
	import '../site.css';
	import { ICON_PATHS } from '../icons';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'features'> } = $props();
</script>

<section class="section">
	<div class="container">
		{#if block.title}<h2>{block.title}</h2>{/if}
		<ul class="grid">
			{#each block.items ?? [] as item (item.id)}
				<li>
					{#if item.icon}
						<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
							<path d={ICON_PATHS[item.icon]} />
						</svg>
					{/if}
					<h3>{item.title ?? ''}</h3>
					{#if item.text}<p class="muted">{item.text}</p>{/if}
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.section {
		padding-block: clamp(2.5rem, 6vw, 4.5rem);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1.25rem;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
	}
	li {
		padding: 1.4rem;
		background: var(--site-surface, #fff);
		border: 1px solid var(--site-border, #e4e0d8);
		border-radius: var(--site-radius, 0.75rem);
	}
	svg {
		fill: none;
		stroke: var(--site-accent, #1f5f4a);
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
		margin-bottom: 0.5rem;
	}
	h3 {
		font-size: 1.1rem;
		margin-bottom: 0.3rem;
	}
	p {
		margin: 0;
	}
</style>
