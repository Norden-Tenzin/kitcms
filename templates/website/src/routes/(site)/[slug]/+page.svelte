<script lang="ts">
	import { resolveDesign } from '#lib/designs.ts';
	import PageView from '#lib/PageView.svelte';

	let { data } = $props();
	const design = $derived(resolveDesign('page', data.site.design, data.content.page.design));
</script>

<PageView {...data.content} {design} siteName={data.site.siteName} tagline={data.site.tagline} />
