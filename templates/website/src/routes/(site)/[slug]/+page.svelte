<script lang="ts">
	import PageView from '#lib/PageView.svelte';

	let { data } = $props();
</script>

<PageView {...data.content} siteName={data.site.siteName} tagline={data.site.tagline} />
