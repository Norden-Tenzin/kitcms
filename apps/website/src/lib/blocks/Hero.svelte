<script lang="ts">
	import '../site.css';
	import InstallCommand from '../InstallCommand.svelte';
	import Link from '../Link.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'hero'> } = $props();
</script>

<section class="hero">
	<div class="container">
		{#if block.eyebrow}<p class="eyebrow muted">{block.eyebrow}</p>{/if}
		<h1>{block.heading ?? ''}</h1>
		{#if block.subheading}<p class="lead sub">{block.subheading}</p>{/if}
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
</section>

<style>
	.hero {
		padding-block: var(--section);
	}
	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}
	h1 {
		max-width: 20ch;
	}
	.sub {
		max-width: 44rem;
	}
	.cmd {
		margin-block: 1.5rem;
	}
</style>
