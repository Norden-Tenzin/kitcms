<script lang="ts">
	import RenderBlocks from './blocks/RenderBlocks.svelte';
	import type { BlockExtras, PageBlock } from './blocks/types';
	import type { DesignId } from './designs';
	import { asMedia } from './media';
	import Seo from './Seo.svelte';

	interface Props {
		page: {
			title: string;
			seo?: { metaTitle?: string | null; metaDescription?: string | null; image?: unknown } | null;
		};
		blocks: PageBlock[];
		extras: BlockExtras;
		/** The resolved design for this page (see `designs.ts`). */
		design: DesignId;
		siteName?: string | null;
		tagline?: string | null;
	}
	let { page, blocks, extras, design, siteName, tagline }: Props = $props();
</script>

<Seo
	title={page.seo?.metaTitle || page.title}
	description={page.seo?.metaDescription || tagline}
	image={asMedia(page.seo?.image)}
	{siteName}
/>

<RenderBlocks {blocks} {extras} {design} />
