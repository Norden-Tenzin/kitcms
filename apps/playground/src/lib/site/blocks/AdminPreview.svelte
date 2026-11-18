<script lang="ts">
	// The admin's live preview for every block (registered per block in `src/kitcms.admin.ts`). It
	// renders the real block components from the live form values, in the home page's A design (the
	// design is a per-page choice the editor makes on the page itself). Upload fields hold ids there,
	// so it resolves them to media docs first (`ResolveMedia`). Collection-listing blocks show a
	// labelled placeholder because their data is not loaded here.
	import '@fontsource-variable/hanken-grotesk';
	import '@fontsource/instrument-serif';
	import '../site.css';
	import type { BlockPreviewProps } from '@kitcms/ui';
	import type { Media } from '../media';
	import type { PageBlock } from '../types';
	import ResolveMedia from './ResolveMedia.svelte';
	import RenderBlocks from './RenderBlocks.svelte';

	let { block }: BlockPreviewProps = $props();

	const idOf = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
	const ids = $derived.by(() => {
		const out: string[] = [];
		const single = idOf(block.image);
		if (single) out.push(single);
		if (Array.isArray(block.images)) for (const v of block.images) if (idOf(v)) out.push(idOf(v)!);
		return out;
	});

	let resolved = $state.raw<Record<string, Media | null>>({});
	const onresolve = (id: string, media: Media | null) => {
		if (resolved[id] !== media) resolved = { ...resolved, [id]: media };
	};

	// The block with ids swapped for the resolved media docs (an id that has not resolved yet shows no picture).
	const view = $derived.by(() => {
		const out: Record<string, unknown> = { ...block, id: 'preview' };
		if ('image' in block) out.image = (idOf(block.image) && resolved[idOf(block.image)!]) || null;
		if (Array.isArray(block.images)) out.images = block.images.map((v) => (idOf(v) ? resolved[idOf(v)!] : null)).filter(Boolean);
		return out as unknown as PageBlock;
	});
</script>

{#each ids as id (id)}
	<ResolveMedia {id} {onresolve} />
{/each}

<div class="site preview-scope">
	<RenderBlocks blocks={[view]} design="a" />
</div>

<style>
	/* Reveal animations would hide the preview until scrolled into view. */
	.preview-scope :global(.reveal) {
		opacity: 1 !important;
		transform: none !important;
	}
</style>
