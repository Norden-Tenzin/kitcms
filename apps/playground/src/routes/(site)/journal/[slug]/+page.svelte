<script lang="ts">
	import { page } from '$app/state';
	import { asMedia } from '#lib/site/media.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import PostView from '#lib/site/pages/PostView.svelte';
	import { authorOf } from '#lib/site/pages/postmeta.ts';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const meta = $derived(metaOf(data.post));
	const cover = $derived(asMedia(data.post.cover));
	const jsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'BlogPosting',
			headline: data.post.title,
			description: data.post.excerpt || undefined,
			datePublished: data.post.publishedAt || undefined,
			image: cover ? new URL(cover.url, page.url.origin).href : undefined,
			author: authorOf(data.post) ? { '@type': 'Person', name: authorOf(data.post)?.name } : undefined,
			publisher: { '@type': 'Organization', name: data.site.siteName },
			mainEntityOfPage: page.url.origin + page.url.pathname,
		},
	]);
</script>

<Seo
	title={meta.title || data.post.title}
	description={meta.description || data.post.excerpt}
	image={meta.image ?? cover}
	noIndex={meta.noIndex}
	type="article"
	siteName={data.site.siteName}
	{jsonLd}
/>
<PostView
	post={data.post}
	newer={data.newer}
	older={data.older}
	related={data.related}
	url={page.url.origin + page.url.pathname}
	design={data.design}
/>
