<script lang="ts">
	// A CMS page: its blocks in the resolved design, with SEO. A page that opens without a hero gets
	// its title as a plain heading so every page has an h1.
	import type { DesignId } from './designs';
	import PageHead from './PageHead.svelte';
	import RenderBlocks from './blocks/RenderBlocks.svelte';
	import { asMedia } from './media';
	import { metaOf } from './meta';
	import Seo from './Seo.svelte';
	import type { BlockExtras, Page, PageBlock } from './types';

	interface Props {
		page: Page;
		blocks: PageBlock[];
		design: DesignId;
		extras: BlockExtras;
		siteName?: string | null;
		tagline?: string | null;
		jsonLd?: object[];
	}
	let { page, blocks, design, extras, siteName, tagline, jsonLd }: Props = $props();
	const meta = $derived(metaOf(page));
	const opensWithHero = $derived(blocks[0]?.blockType === 'hero');
</script>

<Seo
	title={meta.title || page.title}
	description={meta.description || tagline}
	image={meta.image ?? asMedia(page.cover)}
	noIndex={meta.noIndex}
	{siteName}
	{jsonLd}
/>

{#if !opensWithHero}<PageHead title={page.title} />{/if}
<RenderBlocks {blocks} {design} {extras} />
