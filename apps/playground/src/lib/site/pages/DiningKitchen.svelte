<script lang="ts">
	// Dining, design B "Kitchen": immersive. The kitchen fills the first screen with the title on its
	// lower edge, then the menu on solid fields of slate and earth, each course a row you drag sideways.
	import DishMarks from './DishMarks.svelte';
	import Img from '../Img.svelte';
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import { asMedia } from '../media';
	import type { BlockOf, Dish, PageBlock, Page } from '../types';
	import { byCourse, COURSE_NOTE, pick } from './pagedata';

	let { dishes, blocks, cover, lead }: { dishes: Dish[]; blocks: PageBlock[]; cover: Page['cover']; lead?: string } = $props();
	const intro = $derived(pick(blocks, 'split') as BlockOf<'split'> | undefined);
	const steps = $derived((pick(blocks, 'features') as BlockOf<'features'> | undefined)?.items ?? []);
	const groups = $derived(byCourse(dishes));
	const tones = ['slate', 'earth'] as const;
</script>

<header class="hero on-dark">
	<div class="photo"><Img media={asMedia(cover)} eager fit="cover" widths={[800, 1400, 2000]} sizes="100vw" alt="" /></div>
	<div class="container inner">
		<h1>Dining</h1>
		{#if lead}<p class="lead">{lead}</p>{/if}
	</div>
</header>

<Section tone="slate">
	<div class="how">
		<div class="prose-wrap"><RichText doc={intro?.text} /></div>
		{#if steps.length}
			<ul class="steps">
				{#each steps as s, i (s.id ?? i)}<li><h3>{s.label}</h3><p class="small">{s.text}</p></li>{/each}
			</ul>
		{/if}
	</div>
</Section>

{#each groups as g, i (g.course)}
	<Section tone={tones[i % 2]!} bleed class="row-sec">
		<div class="container hd">
			<h2>{g.course}</h2>
			<p class="small">{COURSE_NOTE[g.course]}</p>
		</div>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<ul class="drag" tabindex="0" aria-label={`${g.course}: scroll sideways for more`}>
			{#each g.dishes as d (d.id)}
				<li>
					<h3>{d.name}</h3>
					{#if d.description}<p class="small">{d.description}</p>{/if}
					<DishMarks ladakhi={d.ladakhi} vegetarian={d.vegetarian} />
				</li>
			{/each}
		</ul>
	</Section>
{/each}

<style>
	.hero {
		position: relative;
		min-height: 100svh;
		display: grid;
		align-items: end;
		color: var(--accent-ink);
		isolation: isolate;
	}
	.photo {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: var(--slate);
	}
	.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, var(--scrim), transparent 60%); /* taste-skill-ignore: neutral scrim under text on a photograph */
	}
	.photo :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.inner {
		display: grid;
		gap: var(--s-4);
		padding-block: var(--s-7) var(--s-5);
	}
	.inner h1 {
		font-size: clamp(4.5rem, 1rem + 22vw, 17rem);
		line-height: 0.8;
		margin-bottom: var(--s-2);
	}
	.inner .lead {
		max-width: 34ch;
	}
	.how {
		display: grid;
		gap: var(--s-6);
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-5);
	}
	.steps li {
		display: grid;
		gap: var(--s-1);
	}
	.steps h3 {
		font-size: var(--step-lead);
		color: var(--apricot);
	}
	:global(.row-sec) {
		padding-block: var(--s-7) !important;
		overflow: hidden;
	}
	.hd {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2) var(--s-5);
		margin-bottom: var(--s-5);
	}
	.hd h2 {
		text-transform: capitalize;
	}
	.drag {
		list-style: none;
		margin: 0;
		padding: 0 var(--gutter) var(--s-3);
		display: flex;
		gap: var(--s-3);
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scroll-padding-inline: var(--gutter);
		overscroll-behavior-x: contain;
	}
	.drag > li {
		flex: 0 0 min(80vw, 21rem);
		scroll-snap-align: start;
		display: grid;
		gap: var(--s-3);
		align-content: start;
		padding: var(--s-5);
		background: rgb(255 255 255 / 0.09);
		border-radius: var(--radius);
	}
	@media (min-width: 56rem) {
		.how {
			grid-template-columns: 6fr 5fr;
			gap: var(--s-8, 6rem);
			align-items: start;
		}
		.drag {
			padding-inline: max(var(--gutter), calc((100vw - var(--max)) / 2 + var(--gutter)));
			scroll-padding-inline: max(var(--gutter), calc((100vw - var(--max)) / 2 + var(--gutter)));
		}
	}
</style>
