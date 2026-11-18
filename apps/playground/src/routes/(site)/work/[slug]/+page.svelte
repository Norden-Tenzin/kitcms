<script lang="ts">
	import { asMedia } from '#lib/site/media.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import ProjectView from '#lib/site/pages/ProjectView.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const p = $derived(data.project);
	const meta = $derived(metaOf(p));
	const ld = $derived({
		'@context': 'https://schema.org',
		'@type': 'CreativeWork',
		name: p.title,
		description: p.summary || undefined,
		creator: { '@type': 'Organization', name: data.site.siteName },
		copyrightHolder: p.client ? { '@type': 'Organization', name: p.client } : undefined,
		dateCreated: p.year ? String(p.year) : undefined,
	});
</script>

<Seo
	title={meta.title || p.title}
	description={meta.description || p.summary}
	image={meta.image ?? asMedia(p.cover)}
	noIndex={meta.noIndex}
	siteName={data.site.siteName}
	jsonLd={[ld]}
/>
<ProjectView project={p} next={data.next} prev={data.prev} design={data.design} />
