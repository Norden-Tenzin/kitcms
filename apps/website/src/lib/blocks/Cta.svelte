<script lang="ts">
	import '../site.css';
	import InstallCommand from '../InstallCommand.svelte';
	import Link from '../Link.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'cta'> } = $props();
</script>

<section class="section">
	<div class="container">
		<div class="panel">
			<h2>{block.heading ?? ''}</h2>
			{#if block.text}<p class="lead">{block.text}</p>{/if}
			{#if block.installCommand}<div class="cmd"><InstallCommand command={block.installCommand} /></div>{/if}
			<div class="actions">
				{#if block.primary?.label && block.primary.href}
					<Link href={block.primary.href} class="btn">{block.primary.label}</Link>
				{/if}
				{#if block.secondary?.label && block.secondary.href}
					<Link href={block.secondary.href} class="btn secondary">{block.secondary.label}</Link>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.panel {
		padding: clamp(1.5rem, 1rem + 3vw, 3rem);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.cmd {
		margin-block: 1.25rem;
	}
</style>
