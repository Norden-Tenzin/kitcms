<script lang="ts">
	import { asMedia } from '#lib/site/media.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import PageFrame from '#lib/site/pages/PageFrame.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const meta = $derived(metaOf(data.page));
</script>

<Seo
	title={meta.title || data.page.title}
	description={meta.description || data.site.tagline}
	image={meta.image ?? asMedia(data.page.cover)}
	noIndex={meta.noIndex}
	siteName={data.site.siteName}
/>
<PageFrame page={data.page} blocks={data.blocks} design={data.design} extras={{ ...data.extras, site: data.site }} tagline={data.site.tagline} />
