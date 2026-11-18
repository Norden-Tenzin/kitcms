<script lang="ts">
	import { page } from '$app/state';
	import { asMedia } from '#lib/site/media.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import ExperienceView from '#lib/site/pages/ExperienceView.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const meta = $derived(metaOf(data.item));
	const cover = $derived(asMedia(data.item.cover));
	const jsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'TouristTrip',
			name: data.item.title,
			description: data.item.summary || undefined,
			image: cover ? new URL(cover.url, page.url.origin).href : undefined,
			provider: { '@type': 'Hotel', name: data.site.siteName, url: page.url.origin },
		},
	]);
</script>

<Seo
	title={meta.title || data.item.title}
	description={meta.description || data.item.summary}
	image={meta.image ?? cover}
	noIndex={meta.noIndex}
	siteName={data.site.siteName}
	{jsonLd}
/>
<ExperienceView item={data.item} others={data.others} design={data.design} />
