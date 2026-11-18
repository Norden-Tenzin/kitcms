<script lang="ts">
	// Rich text: A heading in the margin, text in a column. B centred column (the one centred moment).
	// C text on a surface panel.
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import type { BlockProps } from './props';

	let { block, design = 'a' }: BlockProps<'richText'> = $props();
</script>

<Section>
	<div class="wrap {design}">
		{#if block.heading}<h2>{block.heading}</h2>{/if}
		<RichText doc={block.body} />
	</div>
</Section>

<style>
	.wrap {
		display: grid;
		gap: var(--s-5);
	}
	.b {
		justify-items: center;
		text-align: center;
	}
	.b :global(.prose) {
		text-align: left;
	}
	.c {
		background: var(--surface);
		padding: var(--s-6) var(--gutter);
		border-radius: var(--radius);
	}
	@media (min-width: 56rem) {
		.a {
			grid-template-columns: 4fr 7fr;
			gap: var(--s-7);
		}
		.c {
			padding: var(--s-7);
		}
	}
</style>
