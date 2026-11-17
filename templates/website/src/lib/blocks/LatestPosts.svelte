<script lang="ts">
	import '../site.css';
	import { resolve } from '$app/paths';
	import Img from '../Img.svelte';
	import { asMedia } from '../media';
	import type { BlockExtras, BlockOf } from './types';

	// `posts` is loaded by the page route (see `../content.ts`). The admin preview has no data
	// source, so it shows a placeholder.
	let { block, posts }: { block: BlockOf<'latestPosts'>; posts?: BlockExtras['posts'] } = $props();
	const shown = $derived(posts?.slice(0, block.count ?? 3));
	const date = (iso?: string | null) =>
		iso ? new Date(iso).toLocaleDateString('en', { dateStyle: 'medium', timeZone: 'UTC' }) : '';
</script>

<section class="section">
	<div class="container">
		{#if block.title}<h2>{block.title}</h2>{/if}
		{#if shown}
			<ul class="grid">
				{#each shown as post (post.id)}
					{@const cover = asMedia(post.cover)}
					<li>
						<a href={resolve('/(site)/blog/[slug]', { slug: post.slug })}>
							{#if cover}<Img
									media={cover}
									ratio={16 / 10}
									widths={[400, 800, 1200]}
									sizes="(min-width: 48rem) 33vw, 100vw"
								/>{/if}
							<h3>{post.title}</h3>
							{#if post.publishedAt}<p class="muted date">{date(post.publishedAt)}</p>{/if}
							{#if post.excerpt}<p class="muted">{post.excerpt}</p>{/if}
						</a>
					</li>
				{:else}
					<li class="muted">No posts yet.</li>
				{/each}
			</ul>
		{:else}
			<p class="placeholder">Latest posts: the newest published posts appear here on the site.</p>
		{/if}
	</div>
</section>

<style>
	.section {
		padding-block: clamp(2.5rem, 6vw, 4.5rem);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1.5rem;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
	}
	a {
		display: block;
		color: inherit;
		text-decoration: none;
	}
	a:hover h3 {
		text-decoration: underline;
	}
	li :global(img) {
		width: 100%;
		object-fit: cover;
		border-radius: var(--site-radius, 0.75rem);
		margin-bottom: 0.75rem;
	}
	h3 {
		font-size: 1.15rem;
		margin-bottom: 0.2rem;
	}
	p {
		margin: 0.2rem 0 0;
	}
	.date {
		font-size: 0.85rem;
	}
</style>
