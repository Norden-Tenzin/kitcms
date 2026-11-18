<script lang="ts">
	// C "Floating": a solid bar inset from the edges that hovers over the page while it scrolls. The
	// page content starts below it (`.site[data-header='c'] main` in site.css), and the bar has its own
	// ground, so nothing ever sits under it and it never fights a photograph. The menu is always the drawer.
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import type { Shell } from '../shell';
	import MobileMenu from './MobileMenu.svelte';

	let { shell }: { shell: Shell } = $props();
</script>

<header>
	<div class="bar">
		<Link href="/" class="brand">
			{#if shell.logo}<Img media={shell.logo} widths={[80, 160]} sizes="2.5rem" eager alt="" />{/if}
			<span>{shell.siteName}</span>
		</Link>
		<div class="right">
			<Link href={shell.cta.href} class="btn cta">{shell.cta.label}</Link>
			<MobileMenu {shell} always />
		</div>
	</div>
</header>

<style>
	/* A zero-height sticky anchor: the bar floats over the content below without taking space. */
	header {
		position: sticky;
		top: 0.75rem;
		z-index: 20;
		height: 0;
	}
	.bar {
		position: absolute;
		inset: 0 var(--gutter) auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: calc(var(--maxw) - var(--gutter) * 2);
		margin-inline: auto;
		min-height: 3.75rem;
		padding-inline: 1rem 0.5rem;
		background: var(--surface-2);
	}
	.bar :global(.brand) {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.75rem;
		font: 1.7rem/1 var(--font-display);
		letter-spacing: -0.01em;
		text-decoration: none;
	}
	.bar :global(.brand img) {
		width: 2rem;
		height: 2rem;
		object-fit: contain;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.right :global(.cta) {
		display: none;
		min-height: 2.75rem;
	}
	@media (min-width: 40rem) {
		.right :global(.cta) {
			display: inline-flex;
		}
	}
</style>
