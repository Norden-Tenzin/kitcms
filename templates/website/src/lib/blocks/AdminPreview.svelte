<script lang="ts">
	// The admin's live preview for every block (registered per block in `src/kitcms.admin.ts`).
	// It renders the real block components from the live form values. Upload fields hold ids there,
	// so it resolves them to media docs first (`ResolveMedia`).
	import type { BlockPreviewProps } from '@kitcms/ui';
	import Cta from './Cta.svelte';
	import Features from './Features.svelte';
	import Gallery from './Gallery.svelte';
	import Hero from './Hero.svelte';
	import LatestPosts from './LatestPosts.svelte';
	import ResolveMedia from './ResolveMedia.svelte';
	import RichTextBlock from './RichTextBlock.svelte';
	import TeamGrid from './TeamGrid.svelte';
	import type { Media } from '../media';
	import type { BlockOf } from './types';

	let { block }: BlockPreviewProps = $props();

	const idOf = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
	// Upload ids this block shows.
	const ids = $derived.by(() => {
		if (block.blockType === 'hero') return [idOf(block.image)].filter((x) => x !== null);
		if (block.blockType === 'gallery' && Array.isArray(block.images))
			return block.images.map(idOf).filter((x) => x !== null);
		return [];
	});

	let resolved = $state.raw<Record<string, Media | null>>({});
	const onresolve = (id: string, media: Media | null) => {
		if (resolved[id] !== media) resolved = { ...resolved, [id]: media };
	};

	// The block with ids swapped for the resolved media docs.
	const view = $derived({
		...block,
		image: (idOf(block.image) && resolved[idOf(block.image)!]) || null,
		images: ids.map((id) => resolved[id]).filter((m): m is Media => Boolean(m)),
	} as unknown as BlockOf<'hero'> & BlockOf<'gallery'>);
</script>

{#each ids as id (id)}
	<ResolveMedia {id} {onresolve} />
{/each}

{#if block.blockType === 'hero'}
	<Hero block={view} />
{:else if block.blockType === 'richText'}
	<RichTextBlock block={block as unknown as BlockOf<'richText'>} />
{:else if block.blockType === 'features'}
	<Features block={block as unknown as BlockOf<'features'>} />
{:else if block.blockType === 'gallery'}
	<Gallery block={view} />
{:else if block.blockType === 'cta'}
	<Cta block={block as unknown as BlockOf<'cta'>} />
{:else if block.blockType === 'teamGrid'}
	<TeamGrid block={block as unknown as BlockOf<'teamGrid'>} />
{:else if block.blockType === 'latestPosts'}
	<LatestPosts block={block as unknown as BlockOf<'latestPosts'>} />
{/if}
