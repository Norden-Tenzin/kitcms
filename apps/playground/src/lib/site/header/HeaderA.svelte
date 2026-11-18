<script lang="ts">
	// Bar: wordmark left, links right, one action. Sticky.
	import { page } from '$app/state';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import MobileMenu from './MobileMenu.svelte';
	import type { Shell } from '../shell';

	let { shell }: { shell: Shell } = $props();
	const active = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<header>
	<div class="container bar">
		<Link href="/" class="brand">
			{#if shell.logo}<Img media={shell.logo} widths={[80, 160]} sizes="2.5rem" eager alt="" />{/if}
			<span>{shell.siteName}</span>
		</Link>
		<nav aria-label="Main" class="desktop">
			{#each shell.nav as item (item.id)}
				<Link href={item.href} aria-current={active(item.href) ? 'page' : undefined}>{item.label}</Link>
			{/each}
		</nav>
		<Link href={shell.cta.href} class="btn desktop">{shell.cta.label}</Link>
		<MobileMenu {shell} class="mobile" />
	</div>
</header>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--bg);
	}
	.bar {
		display: flex;
		align-items: center;
		gap: var(--s-5);
		min-height: var(--header-h);
		justify-content: space-between;
	}
	.bar :global(.brand) {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		font: 700 1.7rem/1 var(--font-display);
		text-transform: uppercase;
		letter-spacing: 0.01em;
		text-decoration: none;
		min-height: 2.75rem;
	}
	.bar :global(.brand img) {
		width: 2.5rem;
		height: 2.5rem;
		object-fit: contain;
	}
	nav {
		display: flex;
		gap: var(--s-5);
		margin-inline: auto var(--s-4);
	}
	nav :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 500;
		text-decoration: underline 2px transparent;
		text-underline-offset: 0.35em;
		transition: text-decoration-color 0.2s var(--ease);
	}
	nav :global(a:hover),
	nav :global(a[aria-current]) {
		text-decoration-color: currentColor;
	}
	.bar :global(.desktop) {
		display: none;
	}
	@media (min-width: 56rem) {
		.bar :global(nav.desktop) {
			display: flex;
		}
		.bar :global(a.desktop) {
			display: inline-flex;
		}
		.bar :global(.mobile) {
			display: none;
		}
	}
</style>
