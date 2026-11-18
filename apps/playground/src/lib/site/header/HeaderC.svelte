<script lang="ts">
	// Overlay: transparent, minimal. Sits over the first screen (light type when the page opens on a
	// photograph, `overHero`); the menu is always the drawer.
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import MobileMenu from './MobileMenu.svelte';
	import type { Shell } from '../shell';

	let { shell, overHero = false }: { shell: Shell; overHero?: boolean } = $props();
</script>

<header class:over={overHero}>
	<div class="container bar">
		<Link href="/" class="brand">
			{#if shell.logo}<Img media={shell.logo} widths={[80, 160]} sizes="2.5rem" eager alt="" />{/if}
			<span>{shell.siteName}</span>
		</Link>
		<div class="right">
			<Link href={shell.cta.href} class="btn light cta">{shell.cta.label}</Link>
			<MobileMenu {shell} />
		</div>
	</div>
</header>

<style>
	header {
		position: absolute;
		inset: 0 0 auto;
		z-index: 10;
	}
	header.over {
		color: #fff;
	}
	/* A soft neutral scrim under the bar only, so light type stays readable on any photograph. */
	header.over::before {
		content: '';
		position: absolute;
		inset: 0 0 -2rem;
		background: linear-gradient(rgb(20 12 8 / 0.5), transparent); /* neutral scrim under text on a photograph, taste-skill-ignore */
		pointer-events: none;
	}
	.bar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: var(--header-h);
	}
	.bar :global(.brand) {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		font: 700 1.5rem/1 var(--font-display);
		text-transform: uppercase;
		text-decoration: none;
		min-height: 2.75rem;
	}
	.bar :global(.brand img) {
		width: 2.5rem;
		height: 2.5rem;
		object-fit: contain;
	}
	.right {
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}
	.right :global(.cta) {
		display: none;
	}
	@media (min-width: 56rem) {
		.right :global(.cta) {
			display: inline-flex;
		}
	}
</style>
