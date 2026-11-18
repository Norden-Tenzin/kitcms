<script lang="ts">
	// B "Split": a tall header that scrolls away. The wordmark sits in the middle, links split either
	// side, and a tone step (not a line) separates it from the page.
	import { page } from '$app/state';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import { isActive, type Shell } from '../shell';
	import MobileMenu from './MobileMenu.svelte';

	let { shell }: { shell: Shell } = $props();
	const half = $derived(Math.ceil(shell.nav.length / 2));
	const left = $derived(shell.nav.slice(0, half));
	const right = $derived(shell.nav.slice(half));
</script>

<header>
	<div class="container bar">
		<nav aria-label="Main, first half" class="desktop left">
			{#each left as item (item.id)}
				<Link href={item.href} aria-current={isActive(item.href, page.url.pathname) ? 'page' : undefined}>{item.label}</Link>
			{/each}
		</nav>
		<Link href="/" class="brand">
			{#if shell.logo}<Img media={shell.logo} widths={[80, 160]} sizes="2.5rem" eager alt="" />{/if}
			<span>{shell.siteName}</span>
		</Link>
		<nav aria-label="Main, second half" class="desktop right">
			{#each right as item (item.id)}
				<Link href={item.href} aria-current={isActive(item.href, page.url.pathname) ? 'page' : undefined}>{item.label}</Link>
			{/each}
			<Link href={shell.cta.href} class="btn">{shell.cta.label}</Link>
		</nav>
		<MobileMenu {shell} class="mobile" />
	</div>
</header>

<style>
	header {
		background: var(--surface);
	}
	.bar {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		min-height: calc(var(--header-h) + 1rem);
	}
	.bar :global(.brand) {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.75rem;
		font: clamp(2rem, 1.5rem + 1.6vw, 2.8rem) / 1 var(--font-display);
		letter-spacing: -0.015em;
		text-decoration: none;
	}
	.bar :global(.brand img) {
		width: 2.5rem;
		height: 2.5rem;
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
		.bar {
			grid-template-columns: 1fr auto 1fr;
			gap: var(--s-6);
		}
		.desktop {
			display: flex;
			align-items: center;
			gap: var(--s-4);
		}
		.right {
			justify-content: flex-end;
		}
		.bar :global(.mobile) {
			display: none;
		}
	}
</style>
