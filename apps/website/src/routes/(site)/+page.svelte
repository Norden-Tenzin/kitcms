<script lang="ts">
	import RenderBlocks from '#lib/blocks/RenderBlocks.svelte';
	import Seo from '#lib/Seo.svelte';

	let { data } = $props();
</script>

<Seo
	doc={data.content.page}
	siteName={data.site.siteName}
	description={data.site.tagline}
	template={false}
/>
<RenderBlocks blocks={data.content.blocks} />
