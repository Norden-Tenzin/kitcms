<script lang="ts">
	import { asMedia } from '#lib/site/media.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import PostView from '#lib/site/pages/PostView.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const p = $derived(data.post);
	const meta = $derived(metaOf(p));
	const author = $derived((p.author && typeof p.author === 'object' ? (p.author as { name?: string }).name : '') || '');
	const ld = $derived({
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		headline: p.title,
		description: p.excerpt || undefined,
		datePublished: p.publishedAt || undefined,
		author: author ? { '@type': 'Person', name: author } : undefined,
		publisher: { '@type': 'Organization', name: data.site.siteName },
	});
</script>

<Seo
	title={meta.title || p.title}
	description={meta.description || p.excerpt}
	image={meta.image ?? asMedia(p.cover)}
	noIndex={meta.noIndex}
	siteName={data.site.siteName}
	type="article"
	jsonLd={[ld]}
/>
<PostView post={p} related={data.related} design={data.design} />
