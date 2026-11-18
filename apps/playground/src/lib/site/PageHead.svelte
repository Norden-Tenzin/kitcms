<script lang="ts">
	// The heading of a list page (rooms, journal, ...). One shared shape: the page type's designs
	// change what follows, the head stays consistent.
	import type { Snippet } from 'svelte';

	let { title, lead, children }: { title: string; lead?: string | null; children?: Snippet } = $props();
</script>

<header class="container head pt-hdr">
	<h1>{title}</h1>
	{#if lead}<p class="lead">{lead}</p>{/if}
	{@render children?.()}
</header>

<style>
	.head {
		display: grid;
		gap: var(--s-4);
		padding-bottom: var(--s-6);
	}
	.head h1 {
		font-size: clamp(3.4rem, 1rem + 10vw, 9rem);
	}
	@media (min-width: 56rem) {
		.head {
			grid-template-columns: 7fr 4fr;
			align-items: end;
			gap: var(--s-7);
		}
	}
</style>
