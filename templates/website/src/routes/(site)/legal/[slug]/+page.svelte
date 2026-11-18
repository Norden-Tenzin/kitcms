<script lang="ts">
	import RichText from '#lib/RichText.svelte';
	import Seo from '#lib/Seo.svelte';

	let { data } = $props();
</script>

<Seo title={data.doc.title} siteName={data.site.siteName} />

<article class="container wrap">
	<h1>{data.doc.title}</h1>
	<RichText doc={data.doc.body} />
</article>

<style>
	.wrap {
		padding-block: var(--s-6) var(--section);
	}
	h1 {
		font-size: var(--step-h2);
		margin-bottom: var(--s-4);
	}
</style>
