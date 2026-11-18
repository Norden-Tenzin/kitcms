<script lang="ts">
	import { fmtDate } from '#lib/site/format.ts';
	import { asDoc, asMedia } from '#lib/site/media.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import Detail from '#lib/site/pages/Detail.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const meta = $derived(metaOf(data.post));
	const author = $derived(asDoc<{ id: string; name: string }>(data.post.author));
	const line = $derived([fmtDate(data.post.publishedAt), author?.name].filter(Boolean).join(', '));
</script>

<Seo title={meta.title || data.post.title} description={meta.description || data.post.excerpt} image={meta.image ?? asMedia(data.post.cover)} noIndex={meta.noIndex} type="article" siteName={data.site.siteName} />
<Detail title={data.post.title} meta={line} lead={data.post.excerpt} cover={asMedia(data.post.cover)} body={data.post.body} design={data.design} />
