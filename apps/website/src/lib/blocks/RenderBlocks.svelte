<script lang="ts">
	// Maps `blockType` to its component. The same components render the admin live preview
	// (see `AdminPreview.svelte`), so a block looks the same in both places.
	import CodeShowcase from './CodeShowcase.svelte';
	import Cta from './Cta.svelte';
	import Features from './Features.svelte';
	import Hero from './Hero.svelte';
	import HowItWorks from './HowItWorks.svelte';
	import Requirements from './Requirements.svelte';
	import RichTextBlock from './RichTextBlock.svelte';
	import type { PageBlock } from './types';

	let { blocks }: { blocks: PageBlock[] } = $props();
</script>

{#each blocks as block (block.id)}
	{#if block.blockType === 'hero'}
		<Hero {block} />
	{:else if block.blockType === 'features'}
		<Features {block} />
	{:else if block.blockType === 'codeShowcase'}
		<CodeShowcase {block} />
	{:else if block.blockType === 'howItWorks'}
		<HowItWorks {block} />
	{:else if block.blockType === 'requirements'}
		<Requirements {block} />
	{:else if block.blockType === 'cta'}
		<Cta {block} />
	{:else if block.blockType === 'richText'}
		<RichTextBlock {block} />
	{/if}
{/each}
