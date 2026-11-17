<script lang="ts">
	// Maps `blockType` to its component. The same components render the admin live preview
	// (see `AdminPreview.svelte`), so a block looks the same in both places.
	import Cta from './Cta.svelte';
	import Features from './Features.svelte';
	import Gallery from './Gallery.svelte';
	import Hero from './Hero.svelte';
	import LatestPosts from './LatestPosts.svelte';
	import RichTextBlock from './RichTextBlock.svelte';
	import TeamGrid from './TeamGrid.svelte';
	import type { BlockExtras, PageBlock } from './types';

	let { blocks, extras = {} }: { blocks: PageBlock[]; extras?: BlockExtras } = $props();
</script>

{#each blocks as block (block.id)}
	{#if block.blockType === 'hero'}
		<Hero {block} />
	{:else if block.blockType === 'richText'}
		<RichTextBlock {block} />
	{:else if block.blockType === 'features'}
		<Features {block} />
	{:else if block.blockType === 'gallery'}
		<Gallery {block} />
	{:else if block.blockType === 'cta'}
		<Cta {block} />
	{:else if block.blockType === 'teamGrid'}
		<TeamGrid {block} team={extras.team} />
	{:else if block.blockType === 'latestPosts'}
		<LatestPosts {block} posts={extras.posts} />
	{/if}
{/each}
