<script lang="ts">
	import BlogList from '#lib/site/pages/BlogList.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
</script>

<Seo
	title="Blog"
	description="Notes from the studio on identity, websites, briefs and the business of design."
	siteName={data.site.siteName}
	noIndex={data.active !== null || data.page > 1}
/>
<BlogList
	posts={data.posts}
	tags={data.tags}
	active={data.active}
	page={data.page}
	totalPages={data.totalPages}
	design={data.design}
/>
