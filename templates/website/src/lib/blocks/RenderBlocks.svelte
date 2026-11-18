<script lang="ts">
	// Maps `blockType` to its component. The same components render the admin live preview
	// (see `AdminPreview.svelte`), so a block looks the same in both places. `design` is the
	// page's resolved design (`a`, `b` or `c`): every block renders all three.
	import type { DesignId } from '../designs';
	import Cta from './Cta.svelte';
	import Features from './Features.svelte';
	import Gallery from './Gallery.svelte';
	import Hero from './Hero.svelte';
	import LatestPosts from './LatestPosts.svelte';
	import RichTextBlock from './RichTextBlock.svelte';
	import TeamGrid from './TeamGrid.svelte';
	import type { BlockExtras, PageBlock } from './types';

	let {
		blocks,
		extras = {},
		design = 'a',
	}: { blocks: PageBlock[]; extras?: BlockExtras; design?: DesignId } = $props();
</script>

{#each blocks as block (block.id)}
	{#if block.blockType === 'hero'}
		<Hero {block} {design} />
	{:else if block.blockType === 'richText'}
		<RichTextBlock {block} {design} />
	{:else if block.blockType === 'features'}
		<Features {block} {design} />
	{:else if block.blockType === 'gallery'}
		<Gallery {block} {design} />
	{:else if block.blockType === 'cta'}
		<Cta {block} {design} />
	{:else if block.blockType === 'teamGrid'}
		<TeamGrid {block} team={extras.team} {design} />
	{:else if block.blockType === 'latestPosts'}
		<LatestPosts {block} posts={extras.posts} {design} />
	{/if}
{/each}
