<script lang="ts">
	// Selected work, from the `projects` collection. A: a two-column grid, the second column offset.
	// B: one large picture per row with a caption. C: a text index (year, title, client) with a picture beside it on large screens.
	import type { DesignId } from '../designs';
	import Link from '../Link.svelte';
	import { asDoc, asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import Placeholder from './Placeholder.svelte';
	import SectionHead from './SectionHead.svelte';
	import type { BlockOf, Project } from '../types';

	let { block, projects, design = 'a' }: { block: BlockOf<'projectsList'>; projects?: Project[]; design?: DesignId } = $props();
	const shown = $derived(
		(projects ?? []).filter((p) => !block.onlyFeatured || p.featured).slice(0, block.count ?? 4),
	);
	const kinds = (p: Project) =>
		(p.services ?? []).map((s) => asDoc<{ id: string; title: string }>(s)?.title).filter(Boolean).join(', ');
	let hover = $state(0);
</script>

{#if !projects}
	<Placeholder title={block.heading || 'Work'} text="Lists projects from the Work collection (featured only if ticked)." />
{:else if shown.length}
	<section class="blk section" data-design={design}>
		<div class="container">
			<SectionHead heading={block.heading} />
			{#if design === 'c'}
				<div class="index">
					<ul>
						{#each shown as p, i (p.id)}
							<li class="reveal" use:reveal>
								<Link href={`/work/${p.slug}`} onmouseenter={() => (hover = i)} onfocus={() => (hover = i)}>
									<span class="yr">{p.year ?? ''}</span>
									<span class="t">{p.title}</span>
									<span class="k muted">{kinds(p)}</span>
								</Link>
							</li>
						{/each}
					</ul>
					<div class="preview" aria-hidden="true">
						{#key hover}<Pic media={asMedia(shown[hover]?.cover)} ratio={4 / 5} widths={[400, 700]} sizes="30vw" alt="" />{/key}
					</div>
				</div>
			{:else}
				<ul class="cards">
					{#each shown as p, i (p.id)}
						<li class="reveal" use:reveal style:--i={i % 2}>
							<Link href={`/work/${p.slug}`} class="card">
								<Pic media={asMedia(p.cover)} ratio={design === 'b' ? 2 : 4 / 3} widths={[600, 1000, 1600]} sizes={design === 'b' ? '100vw' : '(min-width: 56rem) 50vw, 100vw'} />
								<span class="cap">
									<span class="name">{p.title}</span>
									<span class="meta muted">{[p.client, p.year].filter(Boolean).join(', ')}</span>
								</span>
								{#if design === 'b' && p.summary}<span class="sum muted">{p.summary}</span>{/if}
							</Link>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="all"><Link href="/work" class="more">All work</Link></p>
		</div>
	</section>
{/if}

<style>
	ul {
		list-style: none;
		display: grid;
	}
	.cards {
		gap: var(--s-5) var(--s-4);
	}
	.cards :global(.card) {
		display: grid;
		gap: var(--s-2);
		text-decoration: none;
	}
	.cards :global(.card:hover .name) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.18em;
	}
	.cap {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.25rem var(--s-3);
		margin-top: var(--s-1);
	}
	.name {
		font: var(--step-h3) / 1.05 var(--font-display);
	}
	.sum {
		max-width: 40rem;
	}
	.all {
		margin-top: var(--s-5);
	}

	[data-design='b'] .cards {
		gap: var(--s-6);
	}
	[data-design='b'] .name {
		font-size: clamp(2rem, 1.2rem + 3vw, 3.6rem);
	}

	/* C: the index */
	.index {
		display: grid;
		gap: var(--s-4);
	}
	.index li :global(a) {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		gap: 0 var(--s-3);
		align-items: baseline;
		padding: var(--s-3) var(--gutter);
		margin-inline: calc(var(--gutter) * -1);
		text-decoration: none;
		background: var(--surface);
		transition: background-color 0.2s var(--ease);
	}
	.index li:nth-child(even) :global(a) {
		background: var(--surface-2);
	}
	.index li :global(a:hover) {
		background: var(--accent);
		color: var(--accent-ink);
		--muted: var(--accent-ink);
	}
	.yr {
		font-weight: 600;
		font-size: var(--step-small);
	}
	.t {
		font: clamp(1.8rem, 1rem + 3vw, 3rem) / 1.05 var(--font-display);
	}
	.k {
		grid-column: 2;
	}
	.preview {
		display: none;
	}

	@media (min-width: 56rem) {
		.cards {
			grid-template-columns: 1fr 1fr;
		}
		[data-design='a'] .cards li:nth-child(even) {
			margin-top: var(--s-7);
		}
		[data-design='b'] .cards {
			grid-template-columns: 1fr;
		}
		.index {
			grid-template-columns: 8fr 4fr;
			gap: var(--s-6);
			align-items: start;
		}
		.preview {
			display: block;
			position: relative;
		}
		.index li :global(a) {
			grid-template-columns: 5rem 1fr auto;
		}
		.k {
			grid-column: auto;
		}
	}
</style>
