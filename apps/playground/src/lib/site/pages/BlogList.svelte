<script lang="ts">
	// /blog. A "Journal": the newest post large, then dated entries with a small picture. B "Cards": a
	// grid of picture cards. C "Index": dates and titles on ruled lines, no pictures. The tag filter and
	// the pager are plain links (`?tag=`, `?page=`), so both work without script.
	import type { DesignId } from '../designs';
	import { formatDate } from '../format';
	import Icon from '../Icon.svelte';
	import Link from '../Link.svelte';
	import { asDoc, asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import type { Post, Tag } from '../types';

	interface Props {
		posts: Post[];
		tags: { name: string; slug: string }[];
		active: string | null;
		page: number;
		totalPages: number;
		design?: DesignId;
	}
	let { posts, tags, active, page, totalPages, design = 'a' }: Props = $props();

	const q = (n: number) => {
		const parts = [active ? `tag=${encodeURIComponent(active)}` : '', n > 1 ? `page=${n}` : ''].filter(Boolean);
		return `/blog${parts.length ? `?${parts.join('&')}` : ''}`;
	};
	const tagNames = (p: Post) =>
		(p.tags ?? []).map((t) => asDoc<Tag>(t)?.name).filter(Boolean).join(', ');
	const lead = $derived(design === 'a' && page === 1 ? posts[0] : undefined);
	const rest = $derived(lead ? posts.slice(1) : posts);
</script>

{#snippet entry(p: Post)}
	<span class="date small">{formatDate(p.publishedAt)}</span>
	<span class="t">{p.title}</span>
{/snippet}

<div data-design={design}>
	<header class="container head">
		<h1>Blog</h1>
		<p class="lead muted">Notes from the studio on identity, websites, briefs and what things cost.</p>
		<nav aria-label="Filter by topic" class="chips">
			<Link href="/blog" class="chip" aria-current={active === null ? 'page' : undefined}>All</Link>
			{#each tags as t (t.slug)}
				<Link href={`/blog?tag=${t.slug}`} class="chip" aria-current={active === t.slug ? 'page' : undefined}>{t.name}</Link>
			{/each}
		</nav>
	</header>

	{#if posts.length === 0}
		<p class="container empty lead muted">Nothing here yet. <Link href="/blog" class="link">See every post</Link>.</p>
	{:else}
		{#if lead}
			<div class="container reveal lp-link" use:reveal>
				<Link href={`/blog/${lead.slug}`} class="lead-post">
					<Pic media={asMedia(lead.cover)} ratio={16 / 10} eager widths={[600, 1000, 1500]} sizes="(min-width: 56rem) 60vw, 100vw" />
					<span class="lp-body">
						<span class="date small">{formatDate(lead.publishedAt)} {tagNames(lead) ? `· ${tagNames(lead)}` : ''}</span>
						<span class="lp-t">{lead.title}</span>
						<span class="muted">{lead.excerpt}</span>
						<span class="more">Read the post <Icon name="arrow" size={20} /></span>
					</span>
				</Link>
			</div>
		{/if}

		{#if design === 'c'}
			<ul class="container index">
				{#each rest as p (p.id)}
					<li class="reveal" use:reveal>
						<Link href={`/blog/${p.slug}`} class="row">
							{@render entry(p)}
							<span class="tg muted small">{tagNames(p)}</span>
						</Link>
					</li>
				{/each}
			</ul>
		{:else if design === 'b'}
			<ul class="container cards">
				{#each rest as p, i (p.id)}
					<li class="reveal" use:reveal style:--i={i % 3}>
						<Link href={`/blog/${p.slug}`} class="card">
							<Pic media={asMedia(p.cover)} ratio={3 / 2} eager={i < 3} widths={[500, 800, 1100]} sizes="(min-width: 56rem) 30vw, (min-width: 40rem) 45vw, 100vw" />
							<span class="date small">{formatDate(p.publishedAt)}</span>
							<span class="t">{p.title}</span>
							<span class="muted">{p.excerpt}</span>
						</Link>
					</li>
				{/each}
			</ul>
		{:else}
			<ul class="container journal">
				{#each rest as p (p.id)}
					<li class="reveal" use:reveal>
						<Link href={`/blog/${p.slug}`} class="row">
							<span class="date small">{formatDate(p.publishedAt)}</span>
							<span class="jb">
								<span class="t">{p.title}</span>
								<span class="muted">{p.excerpt}</span>
							</span>
							<span class="jp"><Pic media={asMedia(p.cover)} ratio={4 / 3} widths={[240, 400]} sizes="9rem" alt="" /></span>
						</Link>
					</li>
				{/each}
			</ul>
		{/if}

		{#if totalPages > 1}
			<nav class="container pager" aria-label="Pages">
				{#if page > 1}<Link href={q(page - 1)} class="btn ghost" rel="prev">Newer posts</Link>{/if}
				<span class="small muted">Page {page} of {totalPages}</span>
				{#if page < totalPages}<Link href={q(page + 1)} class="btn ghost" rel="next">Older posts</Link>{/if}
			</nav>
		{/if}
	{/if}
</div>

<style>
	ul {
		list-style: none;
	}
	.head {
		display: grid;
		gap: var(--s-4);
		padding-block: var(--s-5);
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
		transition: background-color 0.2s var(--ease);
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
	.date {
		font-weight: 600;
	}
	ul:last-child {
		padding-bottom: var(--section);
	}
	.t {
		font: var(--step-h3) / 1.05 var(--font-display);
	}
	li :global(a:hover .t),
	.lp-link :global(.lead-post:hover .lp-t) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.15em;
	}
	.pager {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		padding-block: var(--s-6) var(--section);
	}
	ul + .pager {
		padding-top: var(--s-5);
	}

	/* A */
	:global(.lead-post) {
		display: grid;
		gap: var(--s-4);
		text-decoration: none;
		padding-bottom: var(--s-6);
	}
	.lp-body {
		display: grid;
		gap: var(--s-3);
		align-content: end;
		justify-items: start;
	}
	.lp-t {
		font: clamp(2.2rem, 1.2rem + 4vw, 4.5rem) / 1 var(--font-display);
		letter-spacing: -0.02em;
	}
	.journal {
		display: grid;
	}
	.journal li {
		border-top: 1px solid var(--line);
	}
	.journal :global(.row) {
		display: grid;
		grid-template-columns: 1fr 6rem;
		gap: var(--s-2) var(--s-3);
		padding-block: var(--s-4);
		text-decoration: none;
	}
	.journal .date {
		grid-column: 1 / -1;
	}
	.jb {
		display: grid;
		gap: var(--s-2);
	}
	@media (min-width: 56rem) {
		:global(.lead-post) {
			grid-template-columns: 7fr 5fr;
			gap: var(--s-5);
		}
		.journal :global(.row) {
			grid-template-columns: 9rem minmax(0, 1fr) 10rem;
			gap: var(--s-5);
			padding-block: var(--s-5);
			align-items: start;
		}
		.journal .date {
			grid-column: auto;
			padding-top: 0.5rem;
		}
		.jb {
			max-width: 44rem;
		}
	}

	/* B */
	.cards {
		display: grid;
		gap: var(--s-5) var(--s-4);
	}
	.cards :global(.card) {
		display: grid;
		gap: var(--s-2);
		align-content: start;
		text-decoration: none;
	}
	.cards :global(.card .date) {
		margin-top: var(--s-2);
	}
	@media (min-width: 40rem) {
		.cards {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (min-width: 56rem) {
		.cards {
			grid-template-columns: repeat(3, 1fr);
			gap: var(--s-6) var(--s-4);
		}
	}

	/* C */
	.index {
		display: grid;
	}
	.index li {
		border-top: 2px solid var(--ink);
	}
	.index :global(.row) {
		display: grid;
		gap: var(--s-1) var(--s-4);
		padding-block: var(--s-4);
		text-decoration: none;
	}
	.index .t {
		font-size: clamp(1.8rem, 1rem + 3vw, 3.2rem);
	}
	@media (min-width: 56rem) {
		.index :global(.row) {
			grid-template-columns: 9rem minmax(0, 1fr) 14rem;
			align-items: baseline;
		}
		.index .tg {
			text-align: right;
		}
	}
</style>
