<script lang="ts">
	import PageView from '#lib/site/PageView.svelte';

	let { data } = $props();
</script>

<PageView
	page={data.page}
	blocks={data.blocks}
	design={data.design}
	extras={{ ...data.extras, site: data.site }}
	siteName={data.site.siteName}
	tagline={data.site.tagline}
/>
