<script lang="ts">
	// One project (`project` design). A "Case study": title, the cover wide, a facts strip, then the story
	// with the client's quote and a two-column gallery. B "Gallery first": the pictures open the page as a
	// staggered mosaic and the words follow. C "Fact sheet": a tinted fact table beside the cover and text,
	// the gallery as a strip of thumbnails. All three open the same Lightbox.
	import type { DesignId } from '../designs';
	import Icon from '../Icon.svelte';
	import Link from '../Link.svelte';
	import Lightbox from '../Lightbox.svelte';
	import { asDoc, asMedia, asMediaList, type Media } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import RichText from '../RichText.svelte';
	import type { Project, Testimonial } from '../types';

	interface Nav {
		slug: string;
		title: string;
		client?: string | null;
		year?: number | null;
		cover: unknown;
	}
	let { project, next, prev, design = 'a' }: { project: Project; next: Nav | null; prev: Nav | null; design?: DesignId } = $props();

	const cover = $derived(asMedia(project.cover));
	const gallery = $derived(asMediaList(project.gallery));
	// The viewer shows the cover first, then the gallery.
	const all = $derived<Media[]>(cover ? [cover, ...gallery] : gallery);
	const offset = $derived(cover ? 1 : 0);
	const services = $derived(
		(project.services ?? []).flatMap((s) => {
			const d = asDoc<{ id: string; title: string; slug: string }>(s);
			return d ? [d] : [];
		}),
	);
	const quote = $derived(asDoc<Testimonial>(project.testimonial));
	const facts = $derived(project.facts ?? []);
	let lb = $state<number | null>(null);
	// Mosaic rhythm after the first picture: wide, narrow, narrow, wide.
	const wide = (i: number) => [0, 3].includes((i - 1) % 4);
</script>

{#snippet thumb(m: Media, i: number, ratio: number, sizes: string, eager = false)}
	<button type="button" class="open" onclick={() => (lb = i)} aria-label={`Open photograph ${i + 1} of ${all.length}`}>
		<Pic media={m} {ratio} {sizes} {eager} widths={[480, 900, 1400]} />
	</button>
{/snippet}

{#snippet meta()}
	<dl class="meta">
		{#if project.client}<div><dt>Client</dt><dd>{project.client}</dd></div>{/if}
		{#if project.year}<div><dt>Year</dt><dd>{project.year}</dd></div>{/if}
		{#if services.length}
			<div>
				<dt>Services</dt>
				<dd>
					{#each services as s, i (s.id)}{#if i > 0},&nbsp;{/if}<Link href={`/work?service=${s.slug}`} class="link">{s.title}</Link>{/each}
				</dd>
			</div>
		{/if}
		{#each facts as f (f.id)}<div><dt>{f.label}</dt><dd>{f.value}</dd></div>{/each}
	</dl>
{/snippet}

{#snippet testimonial()}
	{#if quote?.quote}
		<figure class="quote reveal" use:reveal>
			<blockquote>{quote.quote}</blockquote>
			<figcaption class="small">
				<strong>{quote.name}</strong>{#if quote.role || quote.company}<span class="muted">&nbsp;{[quote.role, quote.company].filter(Boolean).join(', ')}</span>{/if}
			</figcaption>
		</figure>
	{/if}
{/snippet}

{#snippet pager()}
	{#if next || prev}
		<nav class="pager" aria-label="More work">
			<div class="container pg">
				{#if prev}
					<Link href={`/work/${prev.slug}`} class="pn prev"><span class="small muted">Previous</span><span class="pt">{prev.title}</span></Link>
				{/if}
				{#if next}
					<Link href={`/work/${next.slug}`} class="pn nx"><span class="small muted">Next project</span><span class="pt">{next.title} <Icon name="arrow" size={32} /></span></Link>
				{/if}
			</div>
		</nav>
	{/if}
{/snippet}

<article data-design={design}>
	{#if design === 'b'}
		<header class="container b">
			<h1>{project.title}</h1>
			<p class="lead muted">{project.summary}</p>
		</header>
		<div class="container mosaic">
			{#each all as m, i (m.id)}
				<div class={['m', i === 0 && 'first', i > 0 && (wide(i) ? 'w' : 'n')]}>
					{@render thumb(m, i, i === 0 ? 16 / 9 : wide(i) ? 3 / 2 : 1, i === 0 ? '100vw' : '(min-width: 56rem) 58vw, 100vw', i < 2)}
				</div>
			{/each}
		</div>
		<div class="container bwords section">
			{@render meta()}
			<div class="story"><RichText doc={project.body} />{@render testimonial()}</div>
		</div>
	{:else if design === 'c'}
		<header class="container c">
			<p class="small kick">{[project.client, project.year].filter(Boolean).join(', ')}</p>
			<h1>{project.title}</h1>
		</header>
		<div class="container csheet">
			<aside class="fact surface">
				<h2>Fact sheet</h2>
				{@render meta()}
				{#if project.summary}<p class="muted">{project.summary}</p>{/if}
			</aside>
			<div class="cmain">
				{#if cover}{@render thumb(cover, 0, 4 / 3, '(min-width: 56rem) 60vw, 100vw', true)}{/if}
				<RichText doc={project.body} />
				{@render testimonial()}
			</div>
		</div>
		{#if gallery.length}
			<div class="container strip" role="list" aria-label="Gallery">
				{#each gallery as m, i (m.id)}
					<div role="listitem">{@render thumb(m, i + offset, 4 / 3, '(min-width: 56rem) 22vw, 60vw')}</div>
				{/each}
			</div>
		{/if}
	{:else}
		<header class="container a">
			<p class="small kick">{[project.client, project.year].filter(Boolean).join(', ')}</p>
			<h1>{project.title}</h1>
			<p class="lead muted">{project.summary}</p>
		</header>
		{#if cover}
			<div class="container wide">{@render thumb(cover, 0, 16 / 9, '100vw', true)}</div>
		{/if}
		<div class="container abody section">
			{@render meta()}
			<div class="story"><RichText doc={project.body} />{@render testimonial()}</div>
		</div>
		{#if gallery.length}
			<div class="container agal">
				{#each gallery as m, i (m.id)}
					<div class="reveal" use:reveal>{@render thumb(m, i + offset, i % 3 === 0 ? 16 / 10 : 4 / 5, '(min-width: 56rem) 50vw, 100vw')}</div>
				{/each}
			</div>
		{/if}
	{/if}

	{@render pager()}
</article>

<Lightbox images={all} bind:index={lb} label={project.title ?? 'Project photographs'} />

<style>
	.kick {
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.open {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: zoom-in;
		color: inherit;
	}
	.meta {
		display: grid;
		gap: 0;
		margin: 0;
		align-content: start;
	}
	.meta div {
		display: grid;
		grid-template-columns: 7rem 1fr;
		gap: var(--s-3);
		padding-block: 0.75rem;
		border-top: 1px solid var(--line);
	}
	.meta dt {
		font-size: var(--step-small);
		font-weight: 600;
	}
	.meta dd {
		margin: 0;
	}
	.story {
		display: grid;
		gap: var(--s-5);
		align-content: start;
	}
	.story :global(.prose),
	.cmain :global(.prose) {
		font-size: var(--step-lead);
		line-height: 1.5;
	}
	.quote {
		display: grid;
		gap: var(--s-3);
		margin: 0;
		padding: var(--s-4) 0 0 var(--s-4);
		border-left: 4px solid var(--accent);
	}
	.quote blockquote {
		margin: 0;
		font: clamp(1.6rem, 1.1rem + 1.8vw, 2.4rem) / 1.2 var(--font-display);
	}

	/* A */
	.a {
		display: grid;
		gap: var(--s-3);
		padding-block: var(--s-5);
		justify-items: start;
	}
	.a h1 {
		font-size: clamp(3.4rem, 1rem + 10vw, 9rem);
	}
	.a .lead {
		max-width: 44rem;
	}
	.wide :global(.pic) {
		min-height: 13rem;
	}
	.abody {
		display: grid;
		gap: var(--s-5);
	}
	.agal {
		display: grid;
		gap: var(--s-3);
		padding-bottom: var(--section);
	}
	@media (min-width: 56rem) {
		.abody {
			grid-template-columns: 4fr 7fr;
			gap: var(--s-6);
		}
		.agal {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--s-4);
			align-items: start;
		}
		.agal > :nth-child(3n + 1) {
			grid-column: 1 / -1;
		}
	}

	/* B */
	.b {
		display: grid;
		gap: var(--s-3);
		padding-block: var(--s-5) var(--s-5);
	}
	.b h1 {
		font-size: clamp(2.6rem, 1rem + 7vw, 6rem);
		max-width: 16ch;
	}
	.mosaic {
		display: grid;
		gap: var(--s-3);
	}
	.m :global(.pic) {
		min-height: 8rem;
	}
	.bwords {
		display: grid;
		gap: var(--s-5);
	}
	@media (min-width: 56rem) {
		.b {
			grid-template-columns: 7fr 5fr;
			align-items: end;
		}
		.mosaic {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-4);
			align-items: start;
		}
		.m.first {
			grid-column: 1 / -1;
		}
		.m.w {
			grid-column: span 7;
		}
		.m.n {
			grid-column: span 5;
		}
		.bwords {
			grid-template-columns: 4fr 7fr;
			gap: var(--s-6);
		}
	}

	/* C */
	.c {
		display: grid;
		gap: var(--s-2);
		padding-block: var(--s-5) var(--s-5);
	}
	.c h1 {
		font-size: clamp(3rem, 1rem + 8vw, 8rem);
	}
	.csheet {
		display: grid;
		gap: var(--s-5);
	}
	.fact {
		display: grid;
		gap: var(--s-3);
		align-content: start;
		padding: var(--s-4);
	}
	.fact h2 {
		font-size: var(--step-h3);
	}
	.cmain {
		display: grid;
		gap: var(--s-5);
		align-content: start;
	}
	.strip {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: min(70vw, 22rem);
		gap: var(--s-3);
		overflow-x: auto;
		padding-block: var(--s-5) var(--section);
		scroll-snap-type: x proximity;
	}
	.strip > * {
		scroll-snap-align: start;
	}
	@media (min-width: 56rem) {
		.csheet {
			grid-template-columns: 4fr 8fr;
			gap: var(--s-6);
			align-items: start;
		}
		.strip {
			grid-auto-columns: 1fr;
			grid-auto-flow: row;
			grid-template-columns: repeat(4, 1fr);
			overflow: visible;
		}
	}

	/* Pager */
	.pager {
		margin-top: var(--section);
		padding-block: var(--s-6);
		background: var(--surface);
	}
	.pg {
		display: grid;
		gap: var(--s-4);
	}
	.pager :global(.pn) {
		display: grid;
		gap: var(--s-1);
		text-decoration: none;
		min-height: 2.75rem;
	}
	.pt {
		font: clamp(1.8rem, 1rem + 3vw, 3.4rem) / 1.05 var(--font-display);
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--s-3);
	}
	.pager :global(.pn:hover .pt) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.12em;
	}
	@media (min-width: 56rem) {
		.pg {
			grid-template-columns: 1fr 1fr;
		}
		.pager :global(.nx) {
			text-align: right;
			grid-column: 2;
		}
		.pager :global(.nx .pt) {
			justify-content: flex-end;
		}
		.pager :global(.prev) {
			grid-column: 1;
			grid-row: 1;
		}
	}
</style>
