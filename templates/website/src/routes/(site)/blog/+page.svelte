<script lang="ts">
	import { resolve } from '$app/paths';
	import Img from '#lib/Img.svelte';
	import Link from '#lib/Link.svelte';
	import { asDoc, asMedia } from '#lib/media.ts';
	import Seo from '#lib/Seo.svelte';

	let { data } = $props();
	const posts = $derived(data.posts);
	const date = (iso?: string | null) =>
		iso ? new Date(iso).toLocaleDateString('en', { dateStyle: 'long', timeZone: 'UTC' }) : '';
	const pageHref = (n: number) => `${resolve('/(site)/blog')}${n > 1 ? `?page=${n}` : ''}`;
</script>

<Seo title="Blog" description="News and stories." siteName={data.site.siteName} />

<div class="container wrap">
	<h1>Blog</h1>
	<ul class="grid">
		{#each posts.docs as post (post.id)}
			{@const cover = asMedia(post.cover)}
			<li>
				<a href={resolve('/(site)/blog/[slug]', { slug: post.slug })}>
					{#if cover}<Img
							media={cover}
							ratio={16 / 10}
							widths={[400, 800, 1200]}
							sizes="(min-width: 48rem) 33vw, 100vw"
						/>{/if}
					<h2>{post.title}</h2>
				</a>
				<p class="muted meta">
					{date(post.publishedAt)}
					{#each post.tags ?? [] as tag, i (i)}
						{@const t = asDoc<{ id: string; name: string }>(tag)}
						{#if t}<span class="tag">{t.name}</span>{/if}
					{/each}
				</p>
				{#if post.excerpt}<p>{post.excerpt}</p>{/if}
			</li>
		{:else}
			<li class="muted">No posts yet.</li>
		{/each}
	</ul>

	{#if posts.totalPages > 1}
		<nav class="pager" aria-label="Pagination">
			{#if posts.hasPrevPage}<Link href={pageHref(posts.page - 1)}>Newer</Link>{/if}
			<span class="muted">Page {posts.page} of {posts.totalPages}</span>
			{#if posts.hasNextPage}<Link href={pageHref(posts.page + 1)}>Older</Link>{/if}
		</nav>
	{/if}
</div>

<style>
	.wrap {
		padding-block: 3rem;
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 2rem 1.5rem;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}
	li > a {
		color: inherit;
		text-decoration: none;
		display: block;
	}
	li > a:hover h2 {
		text-decoration: underline;
	}
	li :global(img) {
		width: 100%;
		object-fit: cover;
		border-radius: var(--site-radius);
		margin-bottom: 0.75rem;
	}
	h2 {
		font-size: 1.3rem;
		margin-bottom: 0.2rem;
	}
	p {
		margin: 0.25rem 0;
	}
	.meta {
		font-size: 0.85rem;
	}
	.tag {
		margin-left: 0.5rem;
		padding: 0.05rem 0.55rem;
		border: 1px solid var(--site-border);
		border-radius: 999px;
	}
	.pager {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 1.5rem;
		margin-top: 2.5rem;
	}
	.pager :global(a) {
		color: var(--site-accent);
	}
</style>
