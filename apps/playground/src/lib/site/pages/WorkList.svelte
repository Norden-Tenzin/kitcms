<script lang="ts">
	// /work. A "Grid": three even columns of portrait pictures. B "Large rows": one wide picture per
	// row with the title and summary beside or under it. C "Index": a ruled table (year, title, client,
	// services) with a thumbnail in each row. The service filter is plain links (`?service=`), so it
	// works without script.
	import type { DesignId } from '../designs';
	import Link from '../Link.svelte';
	import { asDoc, asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import type { Project } from '../types';

	interface Props {
		projects: Project[];
		filters: { title: string; slug: string }[];
		active: string | null;
		design?: DesignId;
	}
	let { projects, filters, active, design = 'a' }: Props = $props();
	const kinds = (p: Project) =>
		(p.services ?? []).map((s) => asDoc<{ id: string; title: string }>(s)?.title).filter(Boolean).join(', ');
</script>

<div data-design={design}>
	<header class="container head">
		<h1>Work</h1>
		<p class="lead muted">Identities, websites, products and photographs, made for people who make things.</p>
		<nav aria-label="Filter by service" class="chips">
			<Link href="/work" class="chip" aria-current={active === null ? 'page' : undefined}>All</Link>
			{#each filters as f (f.slug)}
				<Link href={`/work?service=${f.slug}`} class="chip" aria-current={active === f.slug ? 'page' : undefined}>{f.title}</Link>
			{/each}
		</nav>
	</header>

	{#if projects.length === 0}
		<p class="container empty lead muted">No projects here yet. <Link href="/work" class="link">See all work</Link>.</p>
	{:else if design === 'c'}
		<ul class="container index">
			{#each projects as p, i (p.id)}
				<li class="reveal" use:reveal>
					<Link href={`/work/${p.slug}`} class="row">
						<span class="yr">{p.year ?? ''}</span>
						<span class="t">{p.title}</span>
						<span class="cl muted">{p.client ?? ''}</span>
						<span class="kd muted">{kinds(p)}</span>
						<span class="th"><Pic media={asMedia(p.cover)} ratio={4 / 3} eager={i < 3} widths={[240, 400]} sizes="9rem" alt="" /></span>
					</Link>
				</li>
			{/each}
		</ul>
	{:else if design === 'b'}
		<ul class="container rows">
			{#each projects as p, i (p.id)}
				<li class="reveal" use:reveal>
					<Link href={`/work/${p.slug}`} class="row">
						<Pic media={asMedia(p.cover)} ratio={16 / 9} eager={i < 1} widths={[700, 1200, 1800]} sizes="(min-width: 56rem) 70vw, 100vw" />
						<span class="cap">
							<span class="t">{p.title}</span>
							<span class="sum muted">{p.summary}</span>
							<span class="meta small">{[p.client, p.year, kinds(p)].filter(Boolean).join(' · ')}</span>
						</span>
					</Link>
				</li>
			{/each}
		</ul>
	{:else}
		<ul class="container grid">
			{#each projects as p, i (p.id)}
				<li class="reveal" use:reveal style:--i={i % 3}>
					<Link href={`/work/${p.slug}`} class="card">
						<Pic media={asMedia(p.cover)} ratio={4 / 5} eager={i < 3} widths={[500, 800, 1100]} sizes="(min-width: 56rem) 30vw, (min-width: 40rem) 45vw, 100vw" />
						<span class="t">{p.title}</span>
						<span class="meta muted small">{[p.client, p.year].filter(Boolean).join(', ')}</span>
					</Link>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	ul {
		list-style: none;
	}
	.head {
		display: grid;
		gap: var(--s-4);
		padding-block: var(--s-5) var(--s-5);
	}
	.head h1 {
		font-size: clamp(3.4rem, 1rem + 10vw, 9rem);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin-top: var(--s-2);
	}
	.chips :global(.chip) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.3rem 1.1rem;
		border: 2px solid var(--ink);
		text-decoration: none;
		font-weight: 600;
		transition:
			background-color 0.2s var(--ease),
			color 0.2s var(--ease);
	}
	.chips :global(.chip:hover) {
		background: var(--surface-2);
	}
	.chips :global(.chip[aria-current='page']) {
		background: var(--ink);
		color: var(--bg);
	}
	.empty {
		padding-block: var(--s-5) var(--section);
	}
	.t {
		font: var(--step-h3) / 1.05 var(--font-display);
	}
	li :global(a:hover .t) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.15em;
	}
	ul:last-child {
		padding-bottom: var(--section);
	}

	/* A */
	.grid {
		display: grid;
		gap: var(--s-5) var(--s-4);
	}
	.grid :global(.card) {
		display: grid;
		gap: 0.35rem;
		text-decoration: none;
	}
	.grid .t {
		margin-top: var(--s-2);
	}
	@media (min-width: 40rem) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (min-width: 56rem) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
			gap: var(--s-6) var(--s-4);
		}
	}

	/* B */
	.rows {
		display: grid;
		gap: var(--s-6);
	}
	.rows :global(.row) {
		display: grid;
		gap: var(--s-3);
		text-decoration: none;
	}
	.rows .cap {
		display: grid;
		gap: var(--s-2);
		align-content: start;
	}
	.rows .t {
		font-size: clamp(2.2rem, 1.2rem + 4vw, 4.5rem);
		line-height: 1;
	}
	@media (min-width: 56rem) {
		.rows {
			gap: var(--s-7);
		}
		.rows li:nth-child(even) :global(.row) {
			grid-template-columns: 4fr 8fr;
		}
		.rows li:nth-child(odd) :global(.row) {
			grid-template-columns: 8fr 4fr;
		}
		.rows li:nth-child(even) :global(.pic) {
			order: 2;
		}
		.rows :global(.row) {
			gap: var(--s-5);
			align-items: end;
		}
	}

	/* C */
	.index {
		display: grid;
	}
	.index li {
		border-top: 1px solid var(--line);
	}
	.index li:last-child {
		border-bottom: 1px solid var(--line);
	}
	.index :global(.row) {
		display: grid;
		grid-template-columns: 4rem minmax(0, 1fr) 6.5rem;
		gap: 0.15rem var(--s-3);
		align-items: center;
		padding-block: var(--s-3);
		text-decoration: none;
	}
	.index .yr {
		font-weight: 600;
		font-size: var(--step-small);
		grid-row: 1;
	}
	.index .t {
		grid-column: 2;
		font-size: clamp(1.8rem, 1rem + 3vw, 3.2rem);
	}
	.index .cl {
		grid-column: 2;
		font-size: var(--step-small);
	}
	.index .kd {
		display: none;
	}
	.index .th {
		grid-column: 3;
		grid-row: 1 / span 2;
	}
	@media (min-width: 56rem) {
		.index :global(.row) {
			grid-template-columns: 5rem minmax(0, 5fr) minmax(0, 3fr) minmax(0, 3fr) 9rem;
			gap: var(--s-4);
			padding-block: var(--s-4);
		}
		.index .yr,
		.index .t,
		.index .cl,
		.index .th {
			grid-column: auto;
			grid-row: auto;
		}
		.index .kd {
			display: block;
			font-size: var(--step-small);
		}
		.index :global(.row:hover) {
			background: var(--surface);
		}
	}
</style>
