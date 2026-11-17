<script lang="ts">
	import type { ResolvedMeta } from '../meta';

	let { meta, url, siteName }: { meta: ResolvedMeta; url?: string; siteName?: string } = $props();
</script>

<svelte:head>
	<title>{meta.title}</title>
	{#if meta.description}<meta name="description" content={meta.description} />{/if}
	<meta name="robots" content={meta.robots} />
	<meta property="og:title" content={meta.title} />
	{#if meta.description}<meta property="og:description" content={meta.description} />{/if}
	{#if meta.image}<meta property="og:image" content={meta.image} />{/if}
	{#if url}<meta property="og:url" content={url} />{/if}
	{#if siteName}<meta property="og:site_name" content={siteName} />{/if}
	<meta name="twitter:card" content={meta.image ? 'summary_large_image' : 'summary'} />
</svelte:head>
