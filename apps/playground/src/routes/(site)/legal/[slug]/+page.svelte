<script lang="ts">
	import RichText from '#lib/site/RichText.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
</script>

<Seo title={data.doc.title} siteName={data.site.siteName} />

<article class="container wrap">
	<h1>{data.doc.title}</h1>
	<RichText doc={data.doc.body} />
</article>

<style>
	.wrap {
		display: grid;
		gap: var(--s-5);
		padding-block: var(--s-5) var(--section);
	}
	h1 {
		font-size: var(--step-h2);
	}
</style>
