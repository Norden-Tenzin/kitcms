<script lang="ts">
	// Maps `blockType` to its component. The same components render the admin live preview
	// (see `AdminPreview.svelte`), so a block looks the same in both places.
	import type { DesignId } from '../designs';
	import type { BlockExtras, PageBlock } from '../types';
	import Cta from './Cta.svelte';
	import ExperiencesList from './ExperiencesList.svelte';
	import Faq from './Faq.svelte';
	import Features from './Features.svelte';
	import Gallery from './Gallery.svelte';
	import Hero from './Hero.svelte';
	import Location from './Location.svelte';
	import Offers from './Offers.svelte';
	import Quote from './Quote.svelte';
	import RichTextBlock from './RichTextBlock.svelte';
	import RoomsList from './RoomsList.svelte';
	import Split from './Split.svelte';
	import Stats from './Stats.svelte';
	import Testimonials from './Testimonials.svelte';

	let { blocks, design = 'a', extras = {} }: { blocks: PageBlock[]; design?: DesignId; extras?: BlockExtras } = $props();
</script>

{#each blocks as block, i (block.id)}
	{#if block.blockType === 'hero'}
		<Hero {block} {design} first={i === 0} />
	{:else if block.blockType === 'features'}
		<Features {block} {design} />
	{:else if block.blockType === 'richText'}
		<RichTextBlock {block} {design} />
	{:else if block.blockType === 'split'}
		<Split {block} {design} />
	{:else if block.blockType === 'gallery'}
		<Gallery {block} {design} {extras} />
	{:else if block.blockType === 'cta'}
		<Cta {block} {design} />
	{:else if block.blockType === 'stats'}
		<Stats {block} {design} />
	{:else if block.blockType === 'roomsList'}
		<RoomsList {block} {design} {extras} />
	{:else if block.blockType === 'experiencesList'}
		<ExperiencesList {block} {design} {extras} />
	{:else if block.blockType === 'testimonials'}
		<Testimonials {block} {design} {extras} />
	{:else if block.blockType === 'faq'}
		<Faq {block} {design} {extras} />
	{:else if block.blockType === 'quote'}
		<Quote {block} {design} />
	{:else if block.blockType === 'location'}
		<Location {block} {design} {extras} />
	{:else if block.blockType === 'offers'}
		<Offers {block} {design} {extras} />
	{/if}
{/each}
