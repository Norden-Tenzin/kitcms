<script lang="ts">
	import { page } from '$app/state';
	import { hotelLd } from '#lib/site/jsonld.ts';
	import PageView from '#lib/site/PageView.svelte';
	import { asMedia } from '#lib/site/media.ts';
	import { buildShell } from '#lib/site/shell.ts';

	let { data } = $props();
	const shell = $derived(buildShell(data.site, data.legal));
	const ld = $derived([hotelLd(shell, page.url.origin, asMedia(data.page.cover)?.url)]);
</script>

<PageView
	page={data.page}
	blocks={data.blocks}
	design={data.design}
	extras={{ ...data.extras, site: data.site }}
	siteName={data.site.siteName}
	tagline={data.site.tagline}
	jsonLd={ld}
/>
