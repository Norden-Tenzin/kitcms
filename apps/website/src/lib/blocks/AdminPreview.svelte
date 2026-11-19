<script lang="ts">
	// The admin's live preview for every block (registered per block in `src/kitcms.admin.ts`).
	// It renders the real block components from the live form values. Upload fields hold ids there,
	// so the code showcase screenshot is resolved to a media doc first (`ResolveMedia`).
	import type { BlockPreviewProps } from '@kitcms/ui';
	import CodeShowcase from './CodeShowcase.svelte';
	import Cta from './Cta.svelte';
	import Features from './Features.svelte';
	import Hero from './Hero.svelte';
	import HowItWorks from './HowItWorks.svelte';
	import Requirements from './Requirements.svelte';
	import ResolveMedia from './ResolveMedia.svelte';
	import RichTextBlock from './RichTextBlock.svelte';
	import type { Media } from '../media';
	import type { BlockOf } from './types';

	let { block }: BlockPreviewProps = $props();

	const imageId = $derived(
		block.blockType === 'codeShowcase' && typeof block.image === 'string' && block.image
			? block.image
			: null,
	);

	let resolved = $state.raw<Record<string, Media | null>>({});
	const onresolve = (id: string, media: Media | null) => {
		if (resolved[id] !== media) resolved = { ...resolved, [id]: media };
	};

	const showcase = $derived({
		...block,
		image: (imageId && resolved[imageId]) || null,
	} as unknown as BlockOf<'codeShowcase'>);
</script>

{#if imageId}<ResolveMedia id={imageId} {onresolve} />{/if}

{#if block.blockType === 'hero'}
	<Hero block={block as unknown as BlockOf<'hero'>} />
{:else if block.blockType === 'features'}
	<Features block={block as unknown as BlockOf<'features'>} />
{:else if block.blockType === 'codeShowcase'}
	<CodeShowcase block={showcase} />
{:else if block.blockType === 'howItWorks'}
	<HowItWorks block={block as unknown as BlockOf<'howItWorks'>} />
{:else if block.blockType === 'requirements'}
	<Requirements block={block as unknown as BlockOf<'requirements'>} />
{:else if block.blockType === 'cta'}
	<Cta block={block as unknown as BlockOf<'cta'>} />
{:else if block.blockType === 'richText'}
	<RichTextBlock block={block as unknown as BlockOf<'richText'>} />
{/if}
