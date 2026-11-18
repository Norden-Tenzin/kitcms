<script lang="ts">
	import { asMedia } from '#lib/site/media.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import PageFrame from '#lib/site/PageFrame.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const page = $derived(data.content.page);
	const meta = $derived(metaOf(page));
</script>

<Seo
	title={meta.title || page.title}
	description={meta.description || data.site.tagline}
	image={meta.image ?? asMedia(page.cover)}
	noIndex={meta.noIndex}
	siteName={data.site.siteName}
/>
<PageFrame {page} blocks={data.content.blocks} design={data.design} extras={data.content.extras} />
