<script lang="ts">
	import { page } from '$app/state';
	import type { Media } from './media';

	interface Props {
		title?: string | null;
		description?: string | null;
		image?: Media | null;
		siteName?: string | null;
		type?: 'website' | 'article';
		noIndex?: boolean;
		/** schema.org JSON-LD objects. */
		jsonLd?: object[];
	}
	let { title, description, image, siteName, type = 'website', noIndex, jsonLd = [] }: Props = $props();

	const fullTitle = $derived(title && siteName && title !== siteName ? `${title} | ${siteName}` : (title ?? siteName ?? ''));
	// Open Graph wants an absolute URL.
	const ogImage = $derived(image ? new URL(image.url, page.url.href).href : null);
	// `<` is escaped so a value can never close the script element.
	const ld = $derived(jsonLd.map((o) => JSON.stringify(o).replace(/</g, '\\u003c')));
</script>

<svelte:head>
	<title>{fullTitle}</title>
	{#if description}<meta name="description" content={description} />{/if}
	{#if noIndex}<meta name="robots" content="noindex" />{/if}
	<meta property="og:title" content={title ?? siteName ?? ''} />
	{#if description}<meta property="og:description" content={description} />{/if}
	<meta property="og:type" content={type} />
	<meta property="og:url" content={page.url.href} />
	{#if siteName}<meta property="og:site_name" content={siteName} />{/if}
	{#if ogImage}<meta property="og:image" content={ogImage} />{/if}
	<meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
	{#each ld as json (json)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html '<' + 'script type="application/ld+json">' + json + '<' + '/script>'}
	{/each}
</svelte:head>
