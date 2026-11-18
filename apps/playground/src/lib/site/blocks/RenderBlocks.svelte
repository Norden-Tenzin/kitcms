<script lang="ts">
	// Maps `blockType` to its component. `design` is the page's resolved design (`a`, `b` or `c`): every
	// block renders all three. Unknown block types (a block removed from the config) are skipped.
	// The same components render the admin live preview (see `AdminPreview.svelte`).
	import type { DesignId } from '../designs';
	import type { BlockExtras, PageBlock } from '../types';
	import Cta from './Cta.svelte';
	import Faq from './Faq.svelte';
	import Features from './Features.svelte';
	import Gallery from './Gallery.svelte';
	import Hero from './Hero.svelte';
	import LatestPosts from './LatestPosts.svelte';
	import Offers from './Offers.svelte';
	import ProjectsList from './ProjectsList.svelte';
	import Quote from './Quote.svelte';
	import RichTextBlock from './RichTextBlock.svelte';
	import ServicesList from './ServicesList.svelte';
	import Split from './Split.svelte';
	import Stats from './Stats.svelte';
	import TeamGrid from './TeamGrid.svelte';
	import Testimonials from './Testimonials.svelte';

	let { blocks, extras = {}, design = 'a' }: { blocks: PageBlock[]; extras?: BlockExtras; design?: DesignId } = $props();
</script>

{#each blocks as block (block.id)}
	{#if block.blockType === 'hero'}
		<Hero {block} {design} />
	{:else if block.blockType === 'richText'}
		<RichTextBlock {block} {design} />
	{:else if block.blockType === 'features'}
		<Features {block} {design} />
	{:else if block.blockType === 'split'}
		<Split {block} {design} />
	{:else if block.blockType === 'gallery'}
		<Gallery {block} {design} />
	{:else if block.blockType === 'stats'}
		<Stats {block} {design} />
	{:else if block.blockType === 'quote'}
		<Quote {block} {design} />
	{:else if block.blockType === 'faq'}
		<Faq {block} {design} />
	{:else if block.blockType === 'cta'}
		<Cta {block} {design} />
	{:else if block.blockType === 'servicesList'}
		<ServicesList {block} services={extras.services} {design} />
	{:else if block.blockType === 'projectsList'}
		<ProjectsList {block} projects={extras.projects} {design} />
	{:else if block.blockType === 'testimonials'}
		<Testimonials {block} testimonials={extras.testimonials} {design} />
	{:else if block.blockType === 'teamGrid'}
		<TeamGrid {block} team={extras.team} {design} />
	{:else if block.blockType === 'latestPosts'}
		<LatestPosts {block} posts={extras.posts} {design} />
	{:else if block.blockType === 'offers'}
		<Offers {block} offers={extras.offers} {design} />
	{/if}
{/each}
