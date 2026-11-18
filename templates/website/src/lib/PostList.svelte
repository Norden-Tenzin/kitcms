<script lang="ts">
	// Posts as a list, in three designs. A "Journal": text rows with a small picture. B "Cards": a
	// grid with large covers. C "Index": a compact table, date then title. Used by the `latestPosts`
	// block and the blog list.
	import { resolve } from '$app/paths';
	import type { PostSummary } from './blocks/types';
	import type { DesignId } from './designs';
	import { formatDate } from './format';
	import Img from './Img.svelte';
	import { asDoc, asMedia } from './media';

	type Post = PostSummary & { tags?: unknown[] | null };
	let { posts, design = 'a' }: { posts: Post[]; design?: DesignId } = $props();

	const tagNames = (post: Post) =>
		(post.tags ?? []).flatMap((t) => {
			const d = asDoc<{ id: string; name: string }>(t);
			return d ? [d.name] : [];
		});
</script>

<ul class="list" data-design={design}>
	{#each posts as post (post.id)}
		{@const cover = asMedia(post.cover)}
		<li>
			<a href={resolve('/(site)/blog/[slug]', { slug: post.slug })}>
				{#if design === 'b'}
					<div class="cover">
						{#if cover}
							<Img media={cover} ratio={16 / 10} widths={[400, 800, 1200]} sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 100vw" />
						{:else}
							<div class="empty-img ph"></div>
						{/if}
					</div>
				{/if}
				<div class="text">
					<p class="meta small muted">
						<time datetime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time>
						{#each tagNames(post) as name (name)}<span class="tag">{name}</span>{/each}
					</p>
					<h3>{post.title}</h3>
					{#if post.excerpt && design !== 'c'}<p class="excerpt muted">{post.excerpt}</p>{/if}
				</div>
				{#if design === 'a' && cover}
					<div class="thumb">
						<Img media={cover} ratio={1} widths={[160, 320]} sizes="7rem" />
					</div>
				{/if}
			</a>
		</li>
	{:else}
		<li class="muted">No posts yet.</li>
	{/each}
</ul>

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-5);
	}
	a {
		display: flex;
		gap: var(--s-3);
		color: inherit;
		text-decoration: none;
	}
	a:hover h3 {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.2em;
	}
	h3 {
		margin: 0.15em 0 0.25em;
		font-size: 1.3rem;
	}
	p {
		margin: 0;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 0.6rem;
	}
	.excerpt {
		max-width: 38rem;
	}
	.thumb {
		flex: none;
		width: 5.5rem;
		margin-left: auto;
	}
	.thumb :global(img),
	.cover :global(img),
	.ph {
		border-radius: var(--radius);
	}
	.ph {
		aspect-ratio: 16 / 10;
	}

	/* A: rows */
	.list[data-design='a'] {
		--font-display: var(--font-serif);
		gap: var(--s-4);
	}
	.list[data-design='a'] h3 {
		font-weight: 600;
		font-size: 1.4rem;
	}

	/* B: cards */
	.list[data-design='b'] a {
		flex-direction: column;
		gap: var(--s-2);
	}

	/* C: index */
	.list[data-design='c'] {
		gap: 0.35rem;
	}
	.list[data-design='c'] li {
		padding: var(--s-3);
		background: var(--surface);
		border-radius: 0.25rem;
	}
	.list[data-design='c'] a {
		flex-direction: column;
		gap: 0;
	}
	.list[data-design='c'] .meta {
		order: -1;
	}
	.list[data-design='c'] h3 {
		margin: 0;
	}

	@media (min-width: 40rem) {
		.list[data-design='b'] {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--s-5) var(--s-4);
		}
		.thumb {
			width: 7rem;
		}
	}
	@media (min-width: 48rem) {
		.list[data-design='c'] .text {
			display: grid;
			grid-template-columns: 14rem 1fr;
			gap: var(--s-4);
			align-items: baseline;
		}
		.list[data-design='c'] .text .meta {
			order: 0;
		}
		.list[data-design='c'] h3 {
			font-size: 1.5rem;
		}
	}
	@media (min-width: 64rem) {
		.list[data-design='b'] {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
