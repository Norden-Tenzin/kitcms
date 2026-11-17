<script lang="ts">
	import '../../app.css';
	import { page } from '$app/state';
	import Img from '#lib/Img.svelte';
	import Link from '#lib/Link.svelte';
	import { asDoc, asMedia } from '#lib/media.ts';

	let { data, children } = $props();
	const site = $derived(data.site);
	const logo = $derived(asMedia(site.logo));

	// A nav item points to a page (populated at depth 1) or, without one, to a path like `/blog`.
	const nav = $derived(
		(site.nav ?? []).flatMap((item) => {
			const target = asDoc<{ id: string; slug: string }>(item.page);
			const href = target ? (target.slug === 'home' ? '/' : `/${target.slug}`) : item.href;
			return href ? [{ id: item.id, label: item.label, href }] : [];
		}),
	);
	const active = (href: string) =>
		href === '/'
			? page.url.pathname === '/'
			: page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
</script>

<div class="site">
	<a class="skip" href="#main">Skip to content</a>
	<header>
		<div class="container bar">
			<Link href="/" class="brand">
				{#if logo}<Img media={logo} widths={[80, 160, 240]} sizes="2.5rem" eager />{/if}
				<span>{site.siteName ?? 'My site'}</span>
			</Link>
			<nav aria-label="Main">
				{#each nav as item (item.id)}
					<Link href={item.href} class={active(item.href) ? 'active' : ''}>{item.label}</Link>
				{/each}
			</nav>
		</div>
	</header>

	<main id="main">{@render children()}</main>

	<footer>
		<div class="container foot">
			<div>
				<strong>{site.siteName ?? ''}</strong>
				{#if site.footer?.text}<p class="muted">{site.footer.text}</p>{/if}
			</div>
			<nav aria-label="Footer">
				{#each site.footer?.social ?? [] as link (link.id)}
					<Link href={link.url}>{link.label}</Link>
				{/each}
				{#each data.legal as doc (doc.slug)}
					<Link href={`/legal/${doc.slug}`}>{doc.title}</Link>
				{/each}
			</nav>
		</div>
	</footer>
</div>

<style>
	.site {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	main {
		flex: 1;
	}
	.skip {
		position: absolute;
		left: -999px;
	}
	.skip:focus {
		left: 1rem;
		top: 1rem;
		z-index: 10;
		padding: 0.5rem 1rem;
		background: var(--site-surface);
	}
	header {
		border-bottom: 1px solid var(--site-border);
		background: var(--site-bg);
		position: sticky;
		top: 0;
		z-index: 5;
	}
	.bar,
	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 2rem;
		padding-block: 0.9rem;
	}
	.bar :global(.brand) {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-weight: 700;
		font-size: 1.15rem;
		color: inherit;
		text-decoration: none;
	}
	.bar :global(.brand img) {
		width: 2.2rem;
		height: 2.2rem;
		object-fit: contain;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.25rem;
	}
	nav :global(a) {
		color: var(--site-muted);
		text-decoration: none;
		padding-block: 0.25rem;
	}
	nav :global(a:hover),
	nav :global(a.active) {
		color: var(--site-fg);
	}
	nav :global(a.active) {
		box-shadow: inset 0 -2px var(--site-accent);
	}
	footer {
		border-top: 1px solid var(--site-border);
		margin-top: 3rem;
		font-size: 0.95rem;
	}
	.foot {
		align-items: flex-start;
		padding-block: 2rem;
	}
	.foot p {
		margin: 0.3rem 0 0;
		max-width: 28rem;
	}
</style>
