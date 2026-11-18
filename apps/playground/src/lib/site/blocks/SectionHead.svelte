<script lang="ts">
	// The heading (and optional intro) most blocks open with.
	import { reveal } from '../reveal';

	let { heading, intro, class: className }: { heading?: string | null; intro?: string | null; class?: string } = $props();
</script>

{#if heading || intro}
	<header class={['head reveal', className]} use:reveal>
		{#if heading}<h2>{heading}</h2>{/if}
		{#if intro}<p class="lead">{intro}</p>{/if}
	</header>
{/if}

<style>
	.head {
		display: grid;
		gap: var(--s-3);
		margin-bottom: var(--s-5);
	}
	.head .lead {
		color: var(--muted);
	}
</style>
