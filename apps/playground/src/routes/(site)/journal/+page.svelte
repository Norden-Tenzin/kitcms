<script lang="ts">
	import JournalList from '#lib/site/pages/JournalList.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const description = 'Notes from the house: altitude, apricots, and the road.';
	// Filtered and later pages are views of the same list: indexed once, from the first page.
	const noIndex = $derived(Boolean(data.activeTag) || data.page > 1);
</script>

<Seo title={data.activeTag ? `Journal: ${data.activeTag.name}` : 'Journal'} {description} {noIndex} siteName={data.site.siteName} />
<JournalList posts={data.posts} tags={data.tags} activeTag={data.activeTag} page={data.page} totalPages={data.totalPages} design={data.design} />
