<script lang="ts">
	// Three headers (registry: `designs.ts`). A "Bar": brand left, links right, sticky.
	// B "Centred": brand centred with the links under it (a plain bar on phones).
	// C "Band": a full-width field of the accent colour, brand left, links right, sticky.
	import { page } from '$app/state';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import type { DesignId } from '../designs';
	import MobileMenu from './MobileMenu.svelte';
	import { isActive, type Shell } from './shell';

	let { shell, design }: { shell: Shell; design: DesignId } = $props();
</script>

<header data-design={design}>
	<div class="container bar">
		<Link href="/" class="brand" aria-label={`${shell.siteName}, home`}>
			{#if shell.logo}<Img media={shell.logo} widths={[80, 160, 240]} sizes="2.5rem" eager alt="" />{/if}
			<span>{shell.siteName}</span>
		</Link>
		<nav aria-label="Main" class="desktop">
			{#each shell.nav as item (item.id)}
				<Link href={item.href} aria-current={isActive(item.href, page.url.pathname) ? 'page' : undefined}>
					{item.label}
				</Link>
			{/each}
		</nav>
		<div class="mobile"><MobileMenu nav={shell.nav} /></div>
	</div>
</header>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--bg);
		color: var(--ink);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-4);
		min-height: var(--header-h);
	}
	.bar :global(.brand) {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		min-height: 2.75rem;
		font: 700 1.25rem/1.1 var(--font-display);
		letter-spacing: -0.02em;
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
	nav.desktop {
		gap: 0.25rem var(--s-4);
	}
	nav :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 550;
		text-decoration: none;
		color: var(--muted);
		transition: color 0.2s var(--ease);
	}
	nav :global(a:hover) {
		color: var(--ink);
	}
	nav :global(a[aria-current]) {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.45em;
	}

	/* B: centred. */
	header[data-design='b'] {
		position: static;
	}
	/* C: band. */
	header[data-design='c'] {
		background: var(--accent);
		color: var(--accent-ink);
		--focus: var(--accent-ink);
	}
	header[data-design='c'] nav :global(a) {
		color: color-mix(in srgb, var(--accent-ink) 82%, var(--accent));
	}
	header[data-design='c'] nav :global(a:hover),
	header[data-design='c'] nav :global(a[aria-current]) {
		color: var(--accent-ink);
	}

	@media (min-width: 48rem) {
		.desktop {
			display: flex;
		}
		.mobile {
			display: none;
		}
		header[data-design='b'] .bar {
			flex-direction: column;
			justify-content: center;
			gap: var(--s-1);
			padding-block: var(--s-3) var(--s-2);
		}
		header[data-design='b'] .bar :global(.brand) {
			font-size: 1.75rem;
		}
	}
</style>
