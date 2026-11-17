<script lang="ts">
	import '../site.css';
	import Link from '../Link.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'cta'> } = $props();
</script>

<section class="section">
	<div class="container">
		<div class="panel">
			<h2>{block.heading ?? ''}</h2>
			{#if block.text}<p>{block.text}</p>{/if}
			{#if block.buttonLabel && block.buttonHref}
				<Link href={block.buttonHref} class="btn">{block.buttonLabel}</Link>
			{/if}
		</div>
	</div>
</section>

<style>
	.section {
		padding-block: clamp(2rem, 5vw, 4rem);
	}
	.panel {
		padding: clamp(1.75rem, 5vw, 3.5rem);
		text-align: center;
		background: var(--site-surface, #fff);
		border: 1px solid var(--site-border, #e4e0d8);
		border-radius: calc(var(--site-radius, 0.75rem) * 1.5);
	}
	p {
		max-width: 34rem;
		margin: 0 auto 1.5rem;
		color: var(--site-muted, #6b675f);
	}
</style>
