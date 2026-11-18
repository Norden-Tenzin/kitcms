<script lang="ts">
	import { resolve } from '$app/paths';
	import { resolveDesign } from '#lib/designs.ts';
	import Link from '#lib/Link.svelte';
	import PostList from '#lib/PostList.svelte';
	import Seo from '#lib/Seo.svelte';

	let { data } = $props();
	const posts = $derived(data.posts);
	// A "Journal": rows. B "Cards": a grid with covers. C "Index": a compact table. Set in the
	// site settings (Design > Blog list).
	const design = $derived(resolveDesign('blog', data.site.design));
	const pageHref = (n: number) => `${resolve('/(site)/blog')}${n > 1 ? `?page=${n}` : ''}`;
</script>

<Seo title="Blog" description="News and stories." siteName={data.site.siteName} />

<div class="container wrap" data-design={design}>
	<header>
		<h1>Blog</h1>
		<p class="lead muted">News and stories.</p>
	</header>
	<PostList posts={posts.docs} {design} />

	{#if posts.totalPages > 1}
		<nav class="pager" aria-label="Pagination">
			{#if posts.hasPrevPage}<Link href={pageHref(posts.page - 1)} class="btn ghost">Newer</Link>{/if}
			<span class="muted">Page {posts.page} of {posts.totalPages}</span>
			{#if posts.hasNextPage}<Link href={pageHref(posts.page + 1)} class="btn ghost">Older</Link>{/if}
		</nav>
	{/if}
</div>

<style>
	.wrap {
		padding-block: var(--s-6) var(--section);
	}
	header {
		margin-bottom: var(--s-6);
	}
	h1 {
		font-size: clamp(2.25rem, 1.4rem + 3.6vw, 4rem);
		margin-bottom: 0.2em;
	}
	header p {
		margin: 0;
	}
	.wrap[data-design='a'] h1 {
		--font-display: var(--font-serif);
		font-weight: 600;
	}
	.wrap[data-design='a'] header {
		max-width: var(--measure);
	}
	.wrap[data-design='a'] :global(.list) {
		max-width: 46rem;
	}
	.pager {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: var(--s-3) var(--s-4);
		margin-top: var(--s-6);
	}
</style>
