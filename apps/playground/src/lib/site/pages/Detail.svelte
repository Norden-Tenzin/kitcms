<script lang="ts">
	// Placeholder detail layout for experiences and journal posts (part 2 adds the real designs).
	// It already receives the resolved `design` so the data flow is in place.
	import type { Snippet } from 'svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import type { DesignId } from '../designs';
	import type { Media } from '../media';

	interface Props {
		title: string;
		meta?: string;
		lead?: string | null;
		cover?: Media | null;
		body?: unknown;
		design: DesignId;
		children?: Snippet;
	}
	let { title, meta, lead, cover, body, design, children }: Props = $props();
</script>

<article data-design={design}>
	<header class="container head pt-hdr">
		<h1>{title}</h1>
		{#if meta}<p class="small">{meta}</p>{/if}
		{#if lead}<p class="lead">{lead}</p>{/if}
	</header>
	<div class="container"><Pic media={cover} ratio={16 / 8} eager widths={[800, 1400, 2000]} sizes="(min-width: 82rem) 78rem, 100vw" alt="" /></div>
	<div class="container body">
		<RichText doc={body} />
		{@render children?.()}
	</div>
</article>

<style>
	.head {
		display: grid;
		gap: var(--s-3);
		padding-bottom: var(--s-6);
	}
	.head h1 {
		font-size: clamp(3rem, 1rem + 8vw, 7.5rem);
	}
	.body {
		padding-top: var(--s-6);
		display: grid;
		gap: var(--s-6);
	}
</style>
