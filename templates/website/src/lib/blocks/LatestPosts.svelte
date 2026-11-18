<script lang="ts">
	import '../site.css';
	import type { DesignId } from '../designs';
	import PostList from '../PostList.svelte';
	import type { BlockExtras, BlockOf } from './types';

	// `posts` is loaded by the page route (see `../content.ts`). The admin preview has no data
	// source, so it shows a placeholder. The list follows the page's design (A rows, B cards, C index).
	let {
		block,
		posts,
		design = 'a',
	}: { block: BlockOf<'latestPosts'>; posts?: BlockExtras['posts']; design?: DesignId } = $props();
	const shown = $derived(posts?.slice(0, block.count ?? 3));
</script>

<section class="section" data-design={design}>
	<div class="container">
		{#if block.title}<h2>{block.title}</h2>{/if}
		{#if shown}
			<PostList posts={shown} {design} />
		{:else}
			<p class="placeholder">Latest posts: the newest published posts appear here on the site.</p>
		{/if}
	</div>
</section>

<style>
	.section[data-design='a'] h2 {
		--font-display: var(--font-serif);
		font-weight: 600;
	}
	h2 {
		margin-bottom: var(--s-5);
	}
</style>
