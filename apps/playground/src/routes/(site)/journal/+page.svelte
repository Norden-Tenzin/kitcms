<script lang="ts">
	import Link from '#lib/site/Link.svelte';
	import PageHead from '#lib/site/PageHead.svelte';
	import Pic from '#lib/site/Pic.svelte';
	import Seo from '#lib/site/Seo.svelte';
	import { fmtDate } from '#lib/site/format.ts';
	import { asMedia } from '#lib/site/media.ts';

	// Placeholder list (part 2 adds the three journal designs; `data.design` is already resolved).
	let { data } = $props();
</script>

<Seo title="Journal" description="Notes from the house: altitude, apricots, and the road." siteName={data.site.siteName} />
<PageHead title="Journal" lead="Notes from the house: altitude, apricots, and the road." />
<div class="container">
	<ul data-design={data.design}>
		{#each data.posts as p (p.id)}
			<li>
				<Link href={`/journal/${p.slug}`}>
					<Pic media={asMedia(p.cover)} ratio={3 / 2} sizes="(min-width: 56rem) 30vw, 100vw" />
					<p class="small">{fmtDate(p.publishedAt)}</p>
					<h3>{p.title}</h3>
					<p>{p.excerpt}</p>
				</Link>
			</li>
		{/each}
	</ul>
</div>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: var(--s-5) 0 0;
		display: grid;
		gap: var(--s-6);
	}
	li :global(a) {
		display: grid;
		gap: var(--s-2);
		text-decoration: none;
	}
	@media (min-width: 56rem) {
		ul {
			grid-template-columns: repeat(3, 1fr);
			gap: var(--s-6) var(--s-5);
		}
	}
</style>
