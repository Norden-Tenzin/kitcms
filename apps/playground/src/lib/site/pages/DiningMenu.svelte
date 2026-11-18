<script lang="ts">
	// Dining, design A "Menu card": editorial. A big title that touches the first picture, the menu laid
	// out like a printed card (course on the left, dishes on the right), pictures at uneven sizes
	// between the courses.
	import DishMarks from './DishMarks.svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import { asMedia, asMediaList } from '../media';
	import { reveal } from '../reveal';
	import type { BlockOf, Dish, PageBlock } from '../types';
	import { byCourse, COURSE_NOTE, pick } from './pagedata';

	let { dishes, blocks, lead }: { dishes: Dish[]; blocks: PageBlock[]; lead?: string } = $props();
	const intro = $derived(pick(blocks, 'split') as BlockOf<'split'> | undefined);
	const pics = $derived(asMediaList((pick(blocks, 'gallery') as BlockOf<'gallery'> | undefined)?.images));
	const groups = $derived(byCourse(dishes));
</script>

<header class="container head pt-hdr">
	<h1>Dining</h1>
</header>

<div class="container opener">
	<Pic media={asMedia(intro?.image)} ratio={3 / 2} eager widths={[700, 1200, 1800]} sizes="(min-width: 56rem) 62vw, 100vw" class="big" />
	<div class="intro">
		{#if lead}<p class="lead">{lead}</p>{/if}
		<RichText doc={intro?.text} />
	</div>
</div>

<div class="container menu">
	{#each groups as g, i (g.course)}
		<section class="course reveal" class:flip={i % 2 === 1} use:reveal aria-labelledby={`c-${g.course}`}>
			<div class="side">
				<h2 id={`c-${g.course}`}>{g.course}</h2>
				<p class="small">{COURSE_NOTE[g.course]}</p>
				{#if pics[i]}
					<Pic media={pics[i]} ratio={i % 2 ? 1 : 4 / 5} widths={[400, 700, 1000]} sizes="(min-width: 56rem) 22vw, 60vw" class="small-pic" />
				{/if}
			</div>
			<ul class="dishes">
				{#each g.dishes as d (d.id)}
					<li>
						<div class="line"><h3>{d.name}</h3><DishMarks ladakhi={d.ladakhi} vegetarian={d.vegetarian} /></div>
						{#if d.description}<p class="small">{d.description}</p>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.head {
		position: relative;
		z-index: 1;
		margin-bottom: -0.2em;
	}
	.opener {
		display: grid;
		gap: var(--s-5);
	}
	.intro {
		display: grid;
		gap: var(--s-4);
		align-content: end;
	}
	.menu {
		display: grid;
		gap: var(--s-7);
		padding-top: var(--section);
	}
	.course {
		display: grid;
		gap: var(--s-4);
	}
	.side {
		display: grid;
		gap: var(--s-2);
		align-content: start;
	}
	.side h2 {
		text-transform: capitalize;
	}
	.side :global(.small-pic) {
		margin-top: var(--s-3);
		max-width: 16rem;
	}
	.dishes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-5);
	}
	.dishes li {
		display: grid;
		gap: var(--s-1);
		max-width: 46rem;
	}
	.line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-1) var(--s-4);
	}
	h3 {
		font-size: clamp(1.4rem, 1.1rem + 1vw, 1.9rem);
	}
	@media (min-width: 56rem) {
		.opener {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-6);
			align-items: start;
		}
		.opener :global(.big) {
			grid-column: 1 / 9;
		}
		.intro {
			grid-column: 9 / 13;
			padding-top: var(--s-7);
			align-content: start;
		}
		.course {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-6);
			align-items: start;
		}
		.side {
			grid-column: 1 / 5;
		}
		.dishes {
			grid-column: 5 / 13;
		}
		.course.flip .side {
			grid-column: 9 / 13;
			grid-row: 1;
			justify-items: start;
		}
		.course.flip .dishes {
			grid-column: 1 / 9;
			grid-row: 1;
		}
		.course:nth-child(3) .side :global(.small-pic) {
			margin-top: var(--s-7);
		}
	}
</style>
