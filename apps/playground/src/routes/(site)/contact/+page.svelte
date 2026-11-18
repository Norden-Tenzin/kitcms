<script lang="ts">
	import ContactDirections from '#lib/site/pages/ContactDirections.svelte';
	import ContactPostcard from '#lib/site/pages/ContactPostcard.svelte';
	import ContactVisit from '#lib/site/pages/ContactVisit.svelte';
	import { metaOf } from '#lib/site/meta.ts';
	import Seo from '#lib/site/Seo.svelte';
	import { buildShell } from '#lib/site/shell.ts';

	let { data } = $props();
	const shell = $derived(buildShell(data.site, data.legal));
	const meta = $derived(data.page ? metaOf(data.page) : null);
</script>

<Seo title={meta?.title || 'Contact'} description={meta?.description || 'Write to us, call, or message on WhatsApp.'} siteName={data.site.siteName} />
{#if data.design === 'b'}
	<ContactPostcard {shell} blocks={data.blocks} cover={data.page?.cover} />
{:else if data.design === 'c'}
	<ContactDirections {shell} blocks={data.blocks} />
{:else}
	<ContactVisit {shell} blocks={data.blocks} />
{/if}
