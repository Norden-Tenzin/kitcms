<script lang="ts">
	import '../site.css';
	import type { DesignId } from '../designs';
	import Link from '../Link.svelte';
	import type { BlockOf } from './types';

	// A "Editorial": big heading on the left, text and button on the right. B "Immersive": a
	// full-width field of the accent colour. C "Structured": a tinted panel.
	let { block, design = 'a' }: { block: BlockOf<'cta'>; design?: DesignId } = $props();
	const button = $derived(block.buttonLabel && block.buttonHref);
</script>

<section class="section" data-design={design}>
	<div class="container">
		<div class="panel">
			<h2>{block.heading ?? ''}</h2>
			<div class="side">
				{#if block.text}<p class="lead">{block.text}</p>{/if}
				{#if button}
					<Link href={block.buttonHref!} class={['btn', design === 'b' && 'inverse']}>{block.buttonLabel}</Link>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.panel {
		display: grid;
		gap: var(--s-3);
	}
	h2 {
		margin: 0;
	}
	.side p {
		margin-bottom: var(--s-3);
		color: var(--muted);
	}

	/* A */
	.section[data-design='a'] {
		--font-display: var(--font-serif);
	}
	.section[data-design='a'] h2 {
		font-weight: 600;
		font-size: clamp(2rem, 1.2rem + 3.4vw, 3.75rem);
	}

	/* B: full-bleed field */
	.section[data-design='b'] {
		background: var(--accent);
		color: var(--accent-ink);
		--focus: var(--accent-ink);
	}
	.section[data-design='b'] .panel {
		text-align: center;
		justify-items: center;
		gap: var(--s-4);
	}
	.section[data-design='b'] .side p {
		color: inherit;
		opacity: 0.92;
		max-width: 34rem;
	}

	/* C: panel */
	.section[data-design='c'] .panel {
		padding: var(--s-5) var(--s-4);
		background: var(--surface);
		border-radius: var(--radius);
	}

	@media (min-width: 56rem) {
		.section[data-design='a'] .panel {
			grid-template-columns: 7fr 5fr;
			gap: var(--s-6);
			align-items: end;
		}
		.section[data-design='c'] .panel {
			grid-template-columns: 1fr 1fr;
			align-items: center;
			gap: var(--s-6);
			padding: var(--s-6);
		}
	}
</style>
