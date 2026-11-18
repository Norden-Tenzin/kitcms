<script lang="ts">
	import { DIFFICULTY_LABELS } from '#lib/site/format.ts';
	import { asMedia } from '#lib/site/media.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import Detail from '#lib/site/pages/Detail.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const meta = $derived(metaOf(data.item));
	const facts = $derived([data.item.duration, data.item.difficulty ? DIFFICULTY_LABELS[data.item.difficulty] : '', data.item.season, data.item.priceNote].filter(Boolean).join(', '));
</script>

<Seo title={meta.title || data.item.title} description={meta.description || data.item.summary} image={meta.image ?? asMedia(data.item.cover)} noIndex={meta.noIndex} siteName={data.site.siteName} />
<Detail title={data.item.title} meta={facts} lead={data.item.summary} cover={asMedia(data.item.cover)} body={data.item.body} design={data.design} />
