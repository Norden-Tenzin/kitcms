<script lang="ts">
	import PageView from '#lib/PageView.svelte';
	import Seo from '#lib/Seo.svelte';

	let { data } = $props();
</script>

{#if data.content}
	<PageView {...data.content} siteName={data.site.siteName} tagline={data.site.tagline} />
{:else}
	<Seo title={data.site.siteName} description={data.site.tagline} siteName={data.site.siteName} />
	<div class="container empty">
		<h1>Welcome</h1>
		<p class="muted">
			There is no published page with the slug <code>home</code> yet. Run <code>pnpm db:seed</code> to
			add example content, or create and publish a page in the admin.
		</p>
	</div>
{/if}

<style>
	.empty {
		padding-block: 5rem;
	}
</style>
