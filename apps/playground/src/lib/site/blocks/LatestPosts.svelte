<script lang="ts">
	// The newest posts, from the `posts` collection. A: a list (date, title, excerpt). B: three cards
	// with covers. C: one featured post, the rest beside it.
	import type { DesignId } from '../designs';
	import { formatDate } from '../format';
	import Link from '../Link.svelte';
	import { asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import Placeholder from './Placeholder.svelte';
	import SectionHead from './SectionHead.svelte';
	import type { BlockOf, Post } from '../types';

	let { block, posts, design = 'a' }: { block: BlockOf<'latestPosts'>; posts?: Post[]; design?: DesignId } = $props();
	const shown = $derived((posts ?? []).slice(0, block.count ?? 3));
</script>

{#if !posts}
	<Placeholder title={block.heading || 'Latest posts'} text="Shows the newest posts from the Posts collection." />
{:else if shown.length}
	<section class={['blk section', design === 'b' && 'surface']} data-design={design}>
		<div class="container">
			<SectionHead heading={block.heading} />
			<ul>
				{#each shown as post, i (post.id)}
					<li class={['reveal', i === 0 && 'first']} use:reveal style:--i={i}>
						<Link href={`/blog/${post.slug}`} class="post">
							{#if design !== 'a'}
								<Pic media={asMedia(post.cover)} ratio={design === 'c' && i === 0 ? 4 / 3 : 3 / 2} widths={[480, 900]} sizes="(min-width: 56rem) 33vw, 100vw" />
							{/if}
							<span class="date small muted">{formatDate(post.publishedAt)}</span>
							<span class="title">{post.title}</span>
							{#if post.excerpt && (design === 'a' || (design === 'c' && i === 0))}<span class="ex muted">{post.excerpt}</span>{/if}
						</Link>
					</li>
				{/each}
			</ul>
			<p class="all"><Link href="/blog" class="more">All posts</Link></p>
		</div>
	</section>
{/if}

<style>
	ul {
		list-style: none;
		display: grid;
		gap: var(--s-4);
	}
	li :global(.post) {
		display: grid;
		gap: var(--s-1);
		align-content: start;
		text-decoration: none;
	}
	.title {
		font: clamp(1.6rem, 1.2rem + 1.4vw, 2.2rem) / 1.1 var(--font-display);
	}
	li :global(.post:hover .title) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.18em;
	}
	.ex {
		max-width: 38rem;
	}
	.all {
		margin-top: var(--s-5);
	}
	[data-design='a'] li :global(.post) {
		padding: var(--s-3) var(--gutter);
		margin-inline: calc(var(--gutter) * -1);
		background: var(--surface);
	}
	[data-design='b'] li :global(.post),
	[data-design='c'] li :global(.post) {
		gap: var(--s-2);
	}
	@media (min-width: 56rem) {
		[data-design='a'] li :global(.post) {
			grid-template-columns: 10rem 5fr 6fr;
			gap: var(--s-5);
			align-items: baseline;
			padding-block: var(--s-4);
		}
		[data-design='b'] ul {
			grid-template-columns: repeat(3, 1fr);
			gap: var(--s-4);
		}
		[data-design='c'] ul {
			grid-template-columns: 7fr 5fr;
			gap: var(--s-5) var(--s-6);
		}
		[data-design='c'] .first {
			grid-row: span 2;
		}
		[data-design='c'] .first .title {
			font-size: clamp(2.2rem, 1.5rem + 2vw, 3.2rem);
		}
	}
</style>
