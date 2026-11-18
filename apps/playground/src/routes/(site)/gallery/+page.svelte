<script lang="ts">
	import GalleryPage from '#lib/site/pages/GalleryPage.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
</script>

<Seo title="Gallery" description="Pictures of Leh, Changspa and the road." siteName={data.site.siteName} />
<GalleryPage albums={data.albums} design={data.design} />
