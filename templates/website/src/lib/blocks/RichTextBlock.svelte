<script lang="ts">
	import '../site.css';
	import type { DesignId } from '../designs';
	import RichText from '../RichText.svelte';
	import type { BlockOf } from './types';

	// A "Editorial": a serif reading column on the left. B "Immersive": the column centred.
	// C "Structured": the text in a tinted panel.
	let { block, design = 'a' }: { block: BlockOf<'richText'>; design?: DesignId } = $props();
</script>

<section class="section" data-design={design}>
	<div class="container"><div class="body"><RichText doc={block.body} /></div></div>
</section>

<style>
	.section {
		padding-block: var(--s-6);
	}
	.section[data-design='a'] {
		--font-display: var(--font-serif);
	}
	.section[data-design='a'] .body :global(.prose) {
		font-family: var(--font-serif);
		font-size: 1.1875rem;
		line-height: 1.7;
	}
	.section[data-design='a'] .body :global(.prose :is(h1, h2, h3)) {
		font-weight: 600;
	}
	.section[data-design='b'] .body :global(.prose) {
		margin-inline: auto;
	}
	.section[data-design='b'] .body :global(.prose > p:first-child) {
		font-size: var(--step-lead);
	}
	.section[data-design='c'] .body {
		padding: var(--s-4);
		background: var(--surface);
		border-radius: var(--radius);
	}
	@media (min-width: 48rem) {
		.section[data-design='c'] .body {
			padding: var(--s-6);
		}
	}
</style>
