<script lang="ts">
	// Lab pages are plain demonstrations: not indexed, not in the nav.
	import { page } from '$app/state';
	import Link from '#lib/site/Link.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { children } = $props();
	const links = [
		{ href: '/lab', label: 'Lab' },
		{ href: '/lab/fields', label: 'Fields' },
		{ href: '/lab/access', label: 'Access' },
		{ href: '/lab/drafts', label: 'Drafts' },
	];
	const here = (href: string) => (href === '/lab' ? page.url.pathname === '/lab' : page.url.pathname.startsWith(href));
</script>

<Seo title="Lab" noIndex />

<div class="container lab">
	<nav aria-label="Lab">
		{#each links as l (l.href)}
			<Link href={l.href} aria-current={here(l.href) ? 'page' : undefined}>{l.label}</Link>
		{/each}
		<Link href="/admin">Admin</Link>
	</nav>
	{@render children()}
</div>

<style>
	.lab {
		padding-block: var(--s-5) var(--section);
		display: grid;
		gap: var(--s-5);
		font-size: var(--step-0);
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2) var(--s-4);
		border-bottom: 1px solid var(--surface-2);
		padding-bottom: var(--s-2);
	}
	nav :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		text-decoration: none;
	}
	nav :global(a[aria-current='page']) {
		text-decoration: underline;
		text-underline-offset: 0.3em;
	}
	.lab :global(h1) {
		font-size: var(--step-h2);
	}
	.lab :global(h2) {
		font-size: var(--step-h3);
	}
	.lab :global(pre) {
		background: var(--surface);
		padding: var(--s-3);
		overflow-x: auto;
		font-size: var(--step-small);
	}
	.lab :global(ul.plain) {
		list-style: none;
		padding: 0;
		display: grid;
	}
	.lab :global(ul.plain a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}
</style>
