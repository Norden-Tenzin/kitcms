<script lang="ts">
	import Link from '#lib/Link.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Documentation | kitcms docs</title>
	<meta name="description" content="Guides and reference for kitcms: a CMS for SvelteKit on Cloudflare Workers, D1 and R2." />
</svelte:head>

<article class="doc">
	<h1>Documentation</h1>
	<p class="lead">Guides and reference for building with kitcms on Cloudflare Workers, D1 and R2.</p>
	{#each data.nav as section (section.slug)}
		<section class="overview">
			<h2>{section.title}</h2>
			<ul class="overview-list">
				{#each section.pages as p (p.path)}
					<li>
						<Link href={p.path}>{p.title}</Link>
						{#if p.description}<span class="muted">{p.description}</span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</article>

<style>
	.overview {
		margin-top: 2.5rem;
	}
	h2 {
		font-size: clamp(1.4rem, 1.1rem + 1vw, 1.8rem);
		margin-bottom: 0.75rem;
	}
	.overview-list {
		display: grid;
		gap: 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.overview-list li {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 1.25rem 1rem;
		border-radius: 0.75rem;
		background: var(--surface);
	}
	.overview-list :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-size: 1.125rem;
		font-weight: 650;
		text-decoration: none;
	}
	.overview-list :global(a:hover) {
		color: var(--accent);
		text-decoration: underline;
	}
	.overview-list .muted {
		margin-top: -0.25rem;
	}
</style>
