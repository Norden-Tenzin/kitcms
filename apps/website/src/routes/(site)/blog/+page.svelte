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
		padding-block: var(--section);
	}
	.posts {
		margin: 2rem 0 0;
		padding: 0;
		list-style: none;
		max-width: var(--measure);
	}
	.posts li {
		padding-block: 1.25rem;
		border-top: 1px solid var(--line);
	}
	h2 {
		font-size: 1.5rem;
	}
	h2 :global(a) {
		text-decoration: none;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0 0 0.25rem;
		font-size: 0.9375rem;
	}
	.badge {
		padding: 0.1em 0.6em;
		border: 1px solid var(--line);
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--fg);
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
	}
</style>
