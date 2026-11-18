<script lang="ts">
	// A "Bar": a plain sticky bar. Wordmark left, links and one button right.
	import { page } from '$app/state';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import { isActive, type Shell } from '../shell';
	import MobileMenu from './MobileMenu.svelte';

	let { shell }: { shell: Shell } = $props();
</script>

<header>
	<div class="container bar">
		<Link href="/" class="brand">
			{#if shell.logo}<Img media={shell.logo} widths={[80, 160]} sizes="2.5rem" eager alt="" />{/if}
			<span>{shell.siteName}</span>
		</Link>
		<nav aria-label="Main" class="desktop">
			{#each shell.nav as item (item.id)}
				<Link href={item.href} aria-current={isActive(item.href, page.url.pathname) ? 'page' : undefined}>{item.label}</Link>
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
		z-index: 20;
		background: var(--bg);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: var(--header-h);
	}
	.bar :global(.brand) {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.75rem;
		font: 1.9rem/1 var(--font-display);
		letter-spacing: -0.01em;
		text-decoration: none;
	}
	.bar :global(.brand img) {
		width: 2.25rem;
		height: 2.25rem;
		object-fit: contain;
	}
	.desktop {
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
		.desktop {
			display: flex;
			align-items: center;
			gap: var(--s-4);
		}
		.bar :global(.mobile) {
			display: none;
		}
	}
</style>
