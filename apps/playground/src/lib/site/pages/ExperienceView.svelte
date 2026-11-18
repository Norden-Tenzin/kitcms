<script lang="ts">
	// One experience, three compositions. A "Journey": editorial, facts in the margin, pictures at
	// uneven sizes. B "Summit": the photograph is the first screen, facts as big numbers on a field.
	// C "Day sheet": a datasheet with a sticky panel (picture, facts table, one button).
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import { DIFFICULTY_LABELS } from '../format';
	import { asMedia, asMediaList, type Media } from '../media';
	import { reveal } from '../reveal';
	import type { DesignId } from '../designs';
	import type { Experience } from '../types';
	import ExperienceCards from './ExperienceCards.svelte';

	let { item, others, design = 'a' }: { item: Experience; others: Experience[]; design?: DesignId } = $props();
	const cover = $derived(asMedia(item.cover));
	const gallery = $derived(asMediaList(item.gallery));
	const rows = $derived(
		[
			['Time', item.duration],
			['Effort', item.difficulty ? DIFFICULTY_LABELS[item.difficulty] : ''],
			['Season', item.season],
			['Cost', item.priceNote],
		].filter((r): r is [string, string] => Boolean(r[1])),
	);
	const ask = $derived(item.slug ? `/contact?experience=${encodeURIComponent(item.slug)}` : '/contact');
	const SHAPES = [4 / 5, 3 / 2, 1] as const;
</script>

{#snippet figure(m: Media, ratio: number, sizes: string)}
	<figure>
		<Pic media={m} {ratio} {sizes} widths={[600, 1000, 1600]} />
		{#if m.caption || m.credit}
			<figcaption class="small">{[m.caption, m.credit ? `Photo: ${m.credit}` : ''].filter(Boolean).join(' ')}</figcaption>
		{/if}
	</figure>
{/snippet}

{#if design === 'b'}
	<article>
		<header class="b-hero on-dark">
			<div class="photo"><Img media={cover} eager fit="cover" widths={[800, 1400, 2000]} sizes="100vw" alt="" /></div>
			<div class="container inner">
				<h1>{item.title}</h1>
				{#if item.summary}<p class="lead">{item.summary}</p>{/if}
			</div>
		</header>
		{#if rows.length}
			<Section tone="earth" pad="none">
				<dl class="big">
					{#each rows as [k, v] (k)}
						<div><dt class="small">{k}</dt><dd>{v}</dd></div>
					{/each}
				</dl>
			</Section>
		{/if}
		<Section tone="slate">
			<div class="b-body"><RichText doc={item.body} /></div>
		</Section>
		{#if gallery.length}
			<Section bleed pad="none">
				<div class="b-pics">
					{#each gallery as m, i (m.id)}
						<Pic media={m} ratio={i % 3 === 0 ? 16 / 9 : 4 / 3} widths={[600, 1100, 1800]} sizes="(min-width: 56rem) 50vw, 100vw" class={i % 3 === 0 ? 'full' : ''} />
					{/each}
				</div>
			</Section>
		{/if}
		<Section tone="accent" class="b-ask">
			<div class="ask">
				<h2>Ask us about this one</h2>
				<p class="lead">We arrange the car and the driver, the timing and the tea. Tell us when you land.</p>
				<Link href={ask} class="btn light">Enquire about this day</Link>
			</div>
		</Section>
		{#if others.length}
			<Section>
				<h2 class="h2">More days out</h2>
				<ExperienceCards items={others} design="b" limit={4} />
			</Section>
		{/if}
	</article>
{:else if design === 'c'}
	<article>
		<header class="container c-head pt-hdr">
			<h1>{item.title}</h1>
			{#if item.summary}<p class="lead">{item.summary}</p>{/if}
		</header>
		<div class="container c-grid">
			<div class="c-main">
				<RichText doc={item.body} />
				{#if gallery.length}
					<ul class="c-tiles">
						{#each gallery as m (m.id)}
							<li class="reveal" use:reveal>{@render figure(m, 4 / 3, '(min-width: 56rem) 22vw, 50vw')}</li>
						{/each}
					</ul>
				{/if}
			</div>
			<aside class="c-panel" aria-label="The day at a glance">
				<Pic media={cover} ratio={4 / 3} eager widths={[500, 900, 1300]} sizes="(min-width: 56rem) 30vw, 100vw" alt="" />
				<dl>
					{#each rows as [k, v] (k)}
						<div><dt class="small">{k}</dt><dd>{v}</dd></div>
					{/each}
				</dl>
				<Link href={ask} class="btn">Enquire about this day</Link>
			</aside>
		</div>
		{#if others.length}
			<Section tone="surface">
				<h2 class="h2">More days out</h2>
				<ExperienceCards items={others} design="c" limit={4} />
			</Section>
		{/if}
	</article>
{:else}
	<article>
		<header class="container a-head pt-hdr">
			<h1>{item.title}</h1>
			{#if item.summary}<p class="lead">{item.summary}</p>{/if}
		</header>
		<div class="container a-wall">
			<Pic media={cover} ratio={16 / 8} eager widths={[800, 1400, 2000]} sizes="(min-width: 82rem) 78rem, 100vw" alt="" class="a-cover" />
			{#if gallery[0]}
				<div class="a-inset">{@render figure(gallery[0], 4 / 5, '(min-width: 56rem) 22vw, 45vw')}</div>
			{/if}
		</div>
		<Section>
			<div class="a-cols">
				<dl class="a-facts">
					{#each rows as [k, v] (k)}
						<div><dt class="small">{k}</dt><dd>{v}</dd></div>
					{/each}
				</dl>
				<div class="a-text">
					<RichText doc={item.body} />
					<Link href={ask} class="btn">Enquire about this day</Link>
				</div>
			</div>
		</Section>
		{#if gallery.length > 1}
			<Section pad="top">
				<ul class="a-pics">
					{#each gallery.slice(1) as m, i (m.id)}
						<li class="reveal" use:reveal style:--i={i % 3}>{@render figure(m, SHAPES[i % 3]!, '(min-width: 56rem) 33vw, 90vw')}</li>
					{/each}
				</ul>
			</Section>
		{/if}
		{#if others.length}
			<Section>
				<h2 class="h2">More days out</h2>
				<ExperienceCards items={others} design="a" limit={3} />
			</Section>
		{/if}
	</article>
{/if}

<style>
	figure {
		margin: 0;
		display: grid;
		gap: var(--s-2);
	}
	ul,
	dl,
	dd {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.h2 {
		margin-bottom: var(--s-6);
	}

	/* ----- A: Journey ----- */
	.a-head {
		display: grid;
		gap: var(--s-4);
		padding-bottom: var(--s-6);
	}
	.a-head h1 {
		font-size: clamp(3.25rem, 1rem + 10vw, 9rem);
	}
	.a-wall {
		position: relative;
	}
	.a-inset {
		width: 38%;
		margin: calc(var(--s-6) * -1) 0 0 auto;
		position: relative;
		background: var(--bg);
		padding: var(--s-2) 0 0 var(--s-2);
	}
	.a-cols {
		display: grid;
		gap: var(--s-6);
	}
	.a-facts {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--s-4);
		align-content: start;
	}
	.a-facts dd {
		font: 700 1.5rem / 1.1 var(--font-display);
	}
	.a-text {
		display: grid;
		gap: var(--s-5);
		justify-items: start;
	}
	.a-pics {
		display: grid;
		gap: var(--s-6);
	}
	@media (min-width: 56rem) {
		.a-head {
			grid-template-columns: 8fr 4fr;
			align-items: end;
			gap: var(--s-7);
		}
		.a-inset {
			position: absolute;
			right: calc(var(--gutter) + 2rem);
			bottom: -5rem;
			width: 22%;
			margin: 0;
		}
		.a-cols {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-5);
		}
		.a-facts {
			grid-column: 1 / 4;
			grid-template-columns: 1fr;
			align-self: start;
			position: sticky;
			top: calc(var(--header-h) + var(--s-5));
		}
		.a-text {
			grid-column: 5 / 12;
		}
		.a-pics {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-5);
			align-items: start;
		}
		.a-pics li:nth-child(3n + 1) {
			grid-column: 2 / span 4;
		}
		.a-pics li:nth-child(3n + 2) {
			grid-column: span 5;
			margin-top: var(--s-7);
		}
		.a-pics li:nth-child(3n) {
			grid-column: span 3;
		}
	}

	/* ----- B: Summit ----- */
	.b-hero {
		position: relative;
		min-height: 100svh;
		display: grid;
		align-items: end;
		color: #fff;
		isolation: isolate;
	}
	.b-hero .photo {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: var(--slate);
	}
	.b-hero .photo::after {
		content: '';
		position: absolute;
		inset: 35% 0 0;
		background: linear-gradient(transparent, rgb(20 12 8 / 0.8)); /* neutral scrim under text on a photograph, taste-skill-ignore */
	}
	.inner {
		padding-block: var(--s-7) var(--s-6);
		display: grid;
		gap: var(--s-4);
	}
	.b-hero h1 {
		font-size: clamp(3.4rem, 0.8rem + 12vw, 11rem);
	}
	.big {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.big div {
		padding: var(--s-5) var(--gutter);
		display: grid;
		gap: var(--s-1);
		align-content: start;
	}
	.big dt {
		color: inherit;
		opacity: 0.85;
	}
	.big dd {
		font: 700 clamp(1.7rem, 1.2rem + 2.4vw, 3rem) / 1.02 var(--font-display);
	}
	.b-body {
		max-width: 44rem;
		margin-inline: auto;
	}
	.b-body :global(.prose) {
		max-width: none;
	}
	.b-pics {
		display: grid;
		grid-template-columns: 1fr;
	}
	.b-pics :global(.pic) {
		border-radius: 0;
	}
	.ask {
		display: grid;
		gap: var(--s-5);
		justify-items: start;
	}
	@media (min-width: 56rem) {
		.big {
			grid-template-columns: repeat(4, 1fr);
			max-width: var(--max);
			margin-inline: auto;
		}
		.big div {
			padding-block: var(--s-6);
		}
		.b-body {
			max-width: 48rem;
		}
		.b-pics {
			grid-template-columns: 1fr 1fr;
		}
		.b-pics :global(.full) {
			grid-column: 1 / -1;
		}
	}

	/* ----- C: Day sheet ----- */
	.c-head {
		display: grid;
		gap: var(--s-4);
		padding-bottom: var(--s-6);
	}
	.c-head h1 {
		font-size: clamp(3rem, 1rem + 8vw, 7rem);
	}
	.c-grid {
		display: grid;
		gap: var(--s-6);
		padding-bottom: var(--section);
	}
	.c-panel {
		order: -1;
		display: grid;
		gap: var(--s-5);
		align-content: start;
		background: var(--surface);
		padding: var(--s-4);
		border-radius: var(--radius);
	}
	.c-panel dl {
		display: grid;
	}
	.c-panel dl div {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: var(--s-3);
		padding-block: var(--s-3);
		border-top: 1px solid color-mix(in srgb, var(--ink) 28%, transparent); /* a real table row, taste-skill-ignore */
	}
	.c-panel dd {
		font-weight: 600;
	}
	.c-main {
		display: grid;
		gap: var(--s-6);
		align-content: start;
	}
	.c-tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-4);
	}
	@media (min-width: 56rem) {
		.c-head {
			grid-template-columns: 7fr 4fr;
			align-items: end;
			gap: var(--s-7);
		}
		.c-grid {
			grid-template-columns: minmax(0, 7fr) minmax(0, 4fr);
			gap: var(--s-7);
		}
		.c-panel {
			order: 0;
			position: sticky;
			top: calc(var(--header-h) + var(--s-5));
			align-self: start;
			grid-column: 2;
			grid-row: 1;
		}
		.c-main {
			grid-column: 1;
			grid-row: 1;
		}
		.c-tiles {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
