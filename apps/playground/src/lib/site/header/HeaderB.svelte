<script lang="ts">
	// Centred: the wordmark in the middle, links split either side. Sticky.
	import { page } from '$app/state';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import MobileMenu from './MobileMenu.svelte';
	import type { Shell } from '../shell';

	let { shell }: { shell: Shell } = $props();
	const half = $derived(Math.ceil(shell.nav.length / 2));
	const left = $derived(shell.nav.slice(0, half));
	const right = $derived(shell.nav.slice(half));
	const active = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<header>
	<div class="container bar">
		<nav aria-label="Main, first half" class="desktop left">
			{#each left as item (item.id)}
				<Link href={item.href} aria-current={active(item.href) ? 'page' : undefined}>{item.label}</Link>
			{/each}
		</nav>
		<Link href="/" class="brand">
			{#if shell.logo}<Img media={shell.logo} widths={[80, 160]} sizes="2.5rem" eager alt="" />{/if}
			<span>{shell.siteName}</span>
		</Link>
		<nav aria-label="Main, second half" class="desktop right">
			{#each right as item (item.id)}
				<Link href={item.href} aria-current={active(item.href) ? 'page' : undefined}>{item.label}</Link>
			{/each}
			<Link href={shell.cta.href} class="btn">{shell.cta.label}</Link>
		</nav>
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
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		min-height: var(--header-h);
	}
	.bar :global(.brand) {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		font: 700 clamp(1.6rem, 1.2rem + 1.4vw, 2.3rem) / 1 var(--font-display);
		text-transform: uppercase;
		text-decoration: none;
		min-height: 2.75rem;
	}
	.bar :global(.brand img) {
		width: 2.5rem;
		height: 2.5rem;
		object-fit: contain;
	}
	.bar :global(.desktop) {
		display: none;
	}
	nav :global(a:not(.btn)) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 500;
		text-decoration: underline 2px transparent;
		text-underline-offset: 0.35em;
		transition: text-decoration-color 0.2s var(--ease);
	}
	nav :global(a:not(.btn):hover),
	nav :global(a[aria-current]) {
		text-decoration-color: currentColor;
	}
	@media (min-width: 56rem) {
		.bar {
			grid-template-columns: 1fr auto 1fr;
			gap: var(--s-6);
		}
		.bar :global(nav.desktop) {
			display: flex;
			align-items: center;
			gap: var(--s-5);
		}
		.right {
			justify-content: flex-end;
		}
		.bar :global(.mobile) {
			display: none;
		}
	}
</style>
