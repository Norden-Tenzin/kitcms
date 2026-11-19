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
	.overview-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.overview-list li {
		display: flex;
		flex-direction: column;
		padding-block: 0.5rem;
		border-top: 1px solid var(--line);
	}
	.overview-list :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 600;
	}
	.overview-list .muted {
		margin-top: -0.25rem;
		padding-bottom: 0.5rem;
	}
</style>
