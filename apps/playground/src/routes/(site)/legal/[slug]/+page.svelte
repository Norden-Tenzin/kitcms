<script lang="ts">
	import PageHead from '#lib/site/PageHead.svelte';
	import RichText from '#lib/site/RichText.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
</script>

<Seo title={data.doc.title} siteName={data.site.siteName} />
<PageHead title={data.doc.title} />
<div class="container body"><RichText doc={data.doc.body} /></div>

<style>
	.body {
		padding-top: var(--s-5);
	}
</style>
