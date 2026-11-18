<script lang="ts">
	import { asMedia } from '#lib/site/media.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import ServiceView from '#lib/site/pages/ServiceView.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data, } = $props();
	const s = $derived(data.service);
	const meta = $derived(metaOf(s));
	const ld = $derived({
		'@context': 'https://schema.org',
		'@type': 'Service',
		name: s.title,
		description: s.summary || undefined,
		provider: { '@type': 'Organization', name: data.site.siteName },
		areaServed: 'IN',
	});
</script>

<Seo
	title={meta.title || s.title}
	description={meta.description || s.summary}
	image={meta.image ?? asMedia(s.cover)}
	noIndex={meta.noIndex}
	siteName={data.site.siteName}
	jsonLd={[ld]}
/>
<ServiceView service={s} projects={data.projects} others={data.others} design={data.design} />
