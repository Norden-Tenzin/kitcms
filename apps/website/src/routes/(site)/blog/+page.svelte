<script lang="ts">
	import { formatDate } from '#lib/format.ts';
	import Link from '#lib/Link.svelte';

	let { data } = $props();
	const posts = $derived(data.posts);
</script>

<svelte:head>
	<title>Changelog | {data.site.siteName}</title>
	<meta name="description" content="Release notes and posts from the kitcms project." />
</svelte:head>

<div class="container wrap">
	<h1>Changelog</h1>
	<ul class="posts">
		{#each posts.docs as post (post.id)}
			<li>
				<article>
					<p class="meta muted">
						<time datetime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt, 'long')}</time>
						{#if post.kind === 'release' && post.version}<span class="badge">v{post.version}</span>{/if}
					</p>
					<h2><Link href="/blog/{post.slug}">{post.title}</Link></h2>
					{#if post.excerpt}<p class="muted">{post.excerpt}</p>{/if}
				</article>
			</li>
		{:else}
			<li class="muted">No posts yet.</li>
		{/each}
	</ul>

	{#if posts.totalPages > 1}
		<nav class="pager" aria-label="Pages">
			{#if posts.page > 1}
				<Link href={posts.page === 2 ? '/blog' : `/blog?page=${posts.page - 1}`}>Newer</Link>
			{/if}
			<span class="muted">Page {posts.page} of {posts.totalPages}</span>
			{#if posts.page < posts.totalPages}<Link href="/blog?page={posts.page + 1}">Older</Link>{/if}
		</nav>
	{/if}
</div>

<style>
	.wrap {
		padding-block: clamp(3rem, 2rem + 5vw, 6rem) var(--section);
	}
	h1 {
		margin-bottom: clamp(2rem, 1rem + 3vw, 4rem);
	}
	.posts {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.75rem;
	}
	.posts li {
		padding: clamp(1.25rem, 0.5rem + 2vw, 2rem);
		border-radius: 1rem;
		background: var(--surface);
	}
	.posts article {
		display: grid;
		gap: 0.25rem 2rem;
	}
	h2 {
		margin: 0 0 0.25rem;
		font-size: clamp(1.5rem, 1.1rem + 1.5vw, 2.25rem);
	}
	h2 :global(a) {
		text-decoration: none;
	}
	h2 :global(a:hover) {
		color: var(--accent);
		text-decoration: underline;
	}
	.posts p {
		margin: 0;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9375rem;
	}
	.badge {
		padding: 0.1em 0.7em;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.pager {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
	}
	.pager :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 650;
	}
	@media (min-width: 48rem) {
		.posts article {
			grid-template-columns: 11rem minmax(0, 1fr);
		}
		.posts .meta {
			grid-row: 1 / span 2;
			align-self: start;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.4rem;
			padding-top: 0.6rem;
		}
	}
</style>
