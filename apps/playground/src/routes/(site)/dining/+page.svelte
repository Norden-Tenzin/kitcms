<script lang="ts">
	import DiningKitchen from '#lib/site/pages/DiningKitchen.svelte';
	import DiningMenu from '#lib/site/pages/DiningMenu.svelte';
	import DiningTable from '#lib/site/pages/DiningTable.svelte';
	import { metaOf } from '#lib/site/meta.ts';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const LEAD = 'A Ladakhi breakfast every morning. Dinner on request, cooked in the family kitchen. Tell us by noon.';
	const meta = $derived(data.page ? metaOf(data.page) : null);
</script>

<Seo title={meta?.title || 'Dining'} description={meta?.description || 'Ladakhi breakfast, and dinner on request.'} siteName={data.site.siteName} />
{#if data.design === 'b'}
	<DiningKitchen dishes={data.dishes} blocks={data.blocks} cover={data.page?.cover} lead={LEAD} />
{:else if data.design === 'c'}
	<DiningTable dishes={data.dishes} blocks={data.blocks} lead={LEAD} />
{:else}
	<DiningMenu dishes={data.dishes} blocks={data.blocks} lead={LEAD} />
{/if}
