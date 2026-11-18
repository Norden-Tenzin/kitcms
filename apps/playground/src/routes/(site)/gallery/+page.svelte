<script lang="ts">
	import Gallery from '#lib/site/blocks/Gallery.svelte';
	import PageHead from '#lib/site/PageHead.svelte';
	import Seo from '#lib/site/Seo.svelte';

	// Placeholder: each album through the gallery block's design (part 2 builds the page designs).
	let { data } = $props();
</script>

<Seo title="Gallery" description="Pictures of Leh, Changspa and the road." siteName={data.site.siteName} />
<PageHead title="Gallery" lead="The house, the orchard, the monasteries and the road. Credits are at the end." />
{#each data.albums as album (album.id)}
	<Gallery block={{ heading: album.title, images: album.images }} design={data.design} />
{/each}
