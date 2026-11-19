<script lang="ts">
	import '../site.css';
	import InstallCommand from '../InstallCommand.svelte';
	import Link from '../Link.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'hero'> } = $props();
</script>

<section class="hero">
	<div class="container">
		{#if block.eyebrow}<p class="note">{block.eyebrow}</p>{/if}
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
		padding-block: clamp(3rem, 1.5rem + 7vw, 8rem) clamp(4rem, 2.5rem + 7vw, 8rem);
	}
	.note {
		display: inline-block;
		margin-bottom: 1.5rem;
		padding: 0.35rem 0.9rem;
		border-radius: 999px;
		background: var(--surface);
		color: var(--muted);
		font-size: 0.9375rem;
	}
	h1 {
		max-width: 21ch;
		margin-bottom: 0.35em;
	}
	.sub {
		max-width: 38rem;
		margin-bottom: 2rem;
		color: var(--fg);
	}
	.cmd {
		margin-bottom: 1.25rem;
	}
</style>
