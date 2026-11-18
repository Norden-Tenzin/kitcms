<script lang="ts">
	import { page } from '$app/state';
	import { asMedia } from '#lib/site/media.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import { organizationLd } from '#lib/site/jsonld.ts';
	import RenderBlocks from '#lib/site/blocks/RenderBlocks.svelte';
	import Seo from '#lib/site/Seo.svelte';
	import { buildShell } from '#lib/site/shell.ts';

	let { data } = $props();
	const shell = $derived(buildShell(data.site, data.legal));
	const meta = $derived(metaOf(data.content?.page));
	const image = $derived(meta.image ?? asMedia(data.content?.page.cover));
	const ld = $derived([organizationLd(shell, page.url.origin, image?.url)]);
</script>

<Seo
	title={meta.title || data.site.siteName}
	description={meta.description || data.site.tagline}
	{image}
	noIndex={meta.noIndex}
	siteName={data.site.siteName}
	jsonLd={ld}
/>

{#if data.content}
	<RenderBlocks blocks={data.content.blocks} extras={data.content.extras} design={data.design} />
{:else}
	<div class="container empty">
		<h1>Welcome</h1>
		<p class="lead muted">
			There is no published page with the slug <code>home</code> yet. Run <code>pnpm db:seed</code> to add the demo content, or create and publish a page in the admin.
		</p>
	</div>
{/if}

<style>
	.empty {
		padding-block: var(--section);
		display: grid;
		gap: var(--s-3);
	}
</style>
