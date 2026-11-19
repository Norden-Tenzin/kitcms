<script lang="ts">
	import '../site.css';
	import InstallCommand from '../InstallCommand.svelte';
	import Link from '../Link.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'cta'> } = $props();
</script>

<section class="cta">
	<div class="container">
		<h2>{block.heading ?? ''}</h2>
		{#if block.text}<p class="lead">{block.text}</p>{/if}
		{#if block.installCommand}<div class="cmd"><InstallCommand command={block.installCommand} /></div>{/if}
		<div class="actions">
			{#if block.primary?.label && block.primary.href}
				<Link href={block.primary.href} class="btn inv">{block.primary.label}</Link>
			{/if}
			{#if block.secondary?.label && block.secondary.href}
				<Link href={block.secondary.href} class="btn inv secondary">{block.secondary.label}</Link>
			{/if}
		</div>
	</div>
</section>

<style>
	/* A whole field of the accent colour; text on it uses the accent's own ink. */
	.cta {
		padding-block: var(--section);
		background: var(--accent);
		color: var(--accent-ink);
	}
	h2 {
		max-width: 16ch;
		font-size: clamp(2.25rem, 1rem + 5.5vw, 5rem);
		letter-spacing: -0.04em;
	}
	.lead {
		max-width: 34rem;
		color: var(--accent-ink);
	}
	.cmd {
		margin-block: 2rem 1.25rem;
	}
	.cta :global(.btn.inv) {
		background: var(--accent-ink);
		color: var(--accent);
	}
	.cta :global(.btn.inv.secondary) {
		background: transparent;
		color: var(--accent-ink);
		box-shadow: inset 0 0 0 2px var(--accent-ink);
	}
	.cta :global(a:focus-visible),
	.cta :global(button:focus-visible) {
		outline-color: var(--accent-ink);
	}
</style>
