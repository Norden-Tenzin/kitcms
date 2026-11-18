<script lang="ts">
	// One post (`post` design). A "Essay": a narrow centred column, the title large, the cover wide
	// after it. B "Feature": the cover is the first screen with the title on it, the author beside the
	// text. C "Article": title and byline on a tint, the text in a wide column with the author and tags
	// in a rail. All three end with related posts.
	import { toPlainText } from '@kitcms/core/richtext';
	import type { DesignId } from '../designs';
	import { formatDate, initials } from '../format';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import { asDoc, asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import RichText from '../RichText.svelte';
	import type { Post, Tag, TeamMember } from '../types';

	let { post, related, design = 'a' }: { post: Post; related: Post[]; design?: DesignId } = $props();
	const cover = $derived(asMedia(post.cover));
	const author = $derived(asDoc<TeamMember>(post.author));
	const authorPhoto = $derived(asMedia(author?.photo));
	const tags = $derived((post.tags ?? []).flatMap((t) => { const d = asDoc<Tag>(t); return d?.slug ? [d] : []; }));
	const minutes = $derived(Math.max(1, Math.round(toPlainText(post.body).split(/\s+/).filter(Boolean).length / 220)));
	const date = $derived(formatDate(post.publishedAt));
</script>

{#snippet byline()}
	<p class="by small">
		{#if author}<span class="who">{author.name}</span>{/if}
		{#if date}<time datetime={post.publishedAt ?? undefined}>{date}</time>{/if}
		<span>{minutes} min read</span>
	</p>
{/snippet}

{#snippet tagList()}
	{#if tags.length}
		<ul class="tags" aria-label="Topics">
			{#each tags as t (t.id)}<li><Link href={`/blog?tag=${t.slug}`} class="tag">{t.name}</Link></li>{/each}
		</ul>
	{/if}
{/snippet}

{#snippet authorCard()}
	{#if author}
		<div class="author">
			{#if authorPhoto}
				<div class="av"><Pic media={authorPhoto} ratio={1} widths={[120, 240]} sizes="4rem" alt="" /></div>
			{:else}
				<span class="av ini" aria-hidden="true">{initials(author.name)}</span>
			{/if}
			<p><strong>{author.name}</strong><br /><span class="muted small">{author.role ?? ''}</span></p>
		</div>
	{/if}
{/snippet}

<article data-design={design}>
	{#if design === 'b'}
		<header class="b" class:photo={!!cover}>
			{#if cover}<div class="bg"><Img media={cover} fit="cover" eager widths={[800, 1400, 1800]} sizes="100vw" alt="" /></div>{/if}
			<div class="container inner">
				{@render byline()}
				<h1>{post.title}</h1>
			</div>
		</header>
		<div class="container bbody section">
			<aside class="rail">{@render authorCard()}{@render tagList()}</aside>
			<div class="text">
				{#if post.excerpt}<p class="lead">{post.excerpt}</p>{/if}
				<RichText doc={post.body} />
			</div>
		</div>
	{:else if design === 'c'}
		<header class="c surface">
			<div class="container cg">
				<h1>{post.title}</h1>
				<div class="cmeta">{@render byline()}{@render tagList()}</div>
			</div>
		</header>
		<div class="container cbody section">
			<div class="text">
				{#if cover}<Pic media={cover} ratio={16 / 9} eager widths={[600, 1000, 1400]} sizes="(min-width: 56rem) 60vw, 100vw" />{/if}
				<RichText doc={post.body} />
			</div>
			<aside class="rail">
				{@render authorCard()}
				{#if post.excerpt}<p class="muted">{post.excerpt}</p>{/if}
			</aside>
		</div>
	{:else}
		<header class="container a">
			{@render byline()}
			<h1>{post.title}</h1>
			{#if post.excerpt}<p class="lead muted">{post.excerpt}</p>{/if}
		</header>
		{#if cover}
			<div class="container awide"><Pic media={cover} ratio={16 / 9} eager widths={[700, 1200, 1800]} sizes="100vw" alt="" /></div>
		{/if}
		<div class="container acol section">
			<RichText doc={post.body} />
			{@render tagList()}
			{@render authorCard()}
		</div>
	{/if}

	{#if related.length}
		<section class="related surface section" aria-labelledby="rel-h">
			<div class="container">
				<h2 id="rel-h">Keep reading</h2>
				<ul class="rel">
					{#each related as p, i (p.id)}
						<li class="reveal" use:reveal style:--i={i}>
							<Link href={`/blog/${p.slug}`} class="rcard">
								<Pic media={asMedia(p.cover)} ratio={3 / 2} widths={[400, 700, 1000]} sizes="(min-width: 56rem) 30vw, 100vw" />
								<span class="small muted">{formatDate(p.publishedAt)}</span>
								<span class="rt">{p.title}</span>
							</Link>
						</li>
					{/each}
				</ul>
				<p class="all"><Link href="/blog" class="more">All posts</Link></p>
			</div>
		</section>
	{/if}
</article>

<style>
	ul {
		list-style: none;
	}
	h2 {
		font-size: var(--step-h2);
	}
	.by {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem var(--s-3);
		font-weight: 600;
	}
	.by > * + *::before {
		content: '·';
		margin-right: var(--s-3);
		font-weight: 400;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.tags :global(.tag) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.2rem 1rem;
		border: 2px solid currentColor;
		text-decoration: none;
		font-weight: 600;
		font-size: var(--step-small);
	}
	.tags :global(.tag:hover) {
		background: var(--ink);
		color: var(--bg);
	}
	.author {
		display: flex;
		gap: var(--s-3);
		align-items: center;
	}
	.av {
		width: 3.5rem;
		flex: none;
		border-radius: 50%;
		overflow: hidden;
	}
	.ini {
		display: inline-grid;
		place-items: center;
		height: 3.5rem;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
	}
	.text {
		display: grid;
		gap: var(--s-5);
		align-content: start;
		min-width: 0;
	}
	.text :global(.prose),
	.acol :global(.prose) {
		font-size: var(--step-lead);
		line-height: 1.55;
		max-width: 40rem;
	}
	.rail {
		display: grid;
		gap: var(--s-4);
		align-content: start;
	}

	/* A */
	.a {
		display: grid;
		gap: var(--s-4);
		padding-block: var(--s-5);
	}
	.a h1 {
		font-size: clamp(3rem, 1rem + 8vw, 7.5rem);
	}
	.awide :global(.pic) {
		min-height: 12rem;
	}
	/* `.site` raises the specificity above the shared `.container` max-width. */
	:global(.site) .acol {
		display: grid;
		gap: var(--s-5);
		max-width: calc(42rem + 2 * var(--gutter));
		justify-items: start;
	}

	/* B */
	.b {
		position: relative;
		display: flex;
		align-items: flex-end;
		min-height: clamp(26rem, 72svh, 46rem);
		padding-block: var(--s-7) var(--s-6);
		overflow: hidden;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.b.photo {
		color: #fff;
		background: #26282a;
	}
	.b .bg {
		position: absolute;
		inset: 0;
	}
	.b.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(0 0 0 / 0.82), rgb(0 0 0 / 0.35) 65%, rgb(0 0 0 / 0.2));
	}
	.b .inner {
		position: relative;
		z-index: 1;
		display: grid;
		gap: var(--s-3);
	}
	.b h1 {
		font-size: clamp(3rem, 0.8rem + 9vw, 8.5rem);
		max-width: 16ch;
	}
	.bbody {
		display: grid;
		gap: var(--s-5);
	}
	@media (min-width: 56rem) {
		.bbody {
			grid-template-columns: 3fr 7fr;
			gap: var(--s-6);
		}
	}

	/* C */
	.c {
		padding-block: var(--s-6);
	}
	.cg {
		display: grid;
		gap: var(--s-4);
	}
	.c h1 {
		font-size: clamp(2.8rem, 1rem + 6vw, 6.5rem);
	}
	.cmeta {
		display: grid;
		gap: var(--s-3);
		align-content: end;
	}
	.cbody {
		display: grid;
		gap: var(--s-5);
	}
	@media (min-width: 56rem) {
		.cg {
			grid-template-columns: 8fr 4fr;
			gap: var(--s-6);
			align-items: end;
		}
		.cbody {
			grid-template-columns: 8fr 4fr;
			gap: var(--s-6);
		}
	}

	/* Related */
	.related h2 {
		margin-bottom: var(--s-5);
	}
	.rel {
		display: grid;
		gap: var(--s-5) var(--s-4);
	}
	.related :global(.rcard) {
		display: grid;
		gap: 0.3rem;
		text-decoration: none;
	}
	.rt {
		font: var(--step-h3) / 1.05 var(--font-display);
	}
	.related :global(.rcard:hover .rt) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.15em;
	}
	.all {
		margin-top: var(--s-5);
	}
	@media (min-width: 56rem) {
		.rel {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
