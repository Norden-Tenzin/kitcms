<script lang="ts">
	// The page frame: skip link, announcement, header and footer, each in the design the site settings
	// pick. Pages render inside `children`. Header C floats; `site.css` pads `main` so content clears it.
	import type { Snippet } from 'svelte';
	import type { DesignId } from './designs';
	import FooterA from './footer/FooterA.svelte';
	import FooterB from './footer/FooterB.svelte';
	import FooterC from './footer/FooterC.svelte';
	import Announcement from './header/Announcement.svelte';
	import HeaderA from './header/HeaderA.svelte';
	import HeaderB from './header/HeaderB.svelte';
	import HeaderC from './header/HeaderC.svelte';
	import type { Shell } from './shell';

	interface Props {
		shell: Shell;
		header: DesignId;
		footer: DesignId;
		/** Inline CSS variables from the theme (already validated by `themeStyle`). */
		style?: string;
		children: Snippet;
	}
	let { shell, header, footer, style, children }: Props = $props();
</script>

<div class="site" data-header={header} {style}>
	<a class="skip" href="#main">Skip to content</a>
	<Announcement {shell} />
	{#if header === 'c'}
		<HeaderC {shell} />
	{:else if header === 'b'}
		<HeaderB {shell} />
	{:else}
		<HeaderA {shell} />
	{/if}
	<main id="main">{@render children()}</main>
	{#if footer === 'c'}
		<FooterC {shell} />
	{:else if footer === 'b'}
		<FooterB {shell} />
	{:else}
		<FooterA {shell} />
	{/if}
</div>

<style>
	.site {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
	}
	main {
		flex: 1;
	}
	.skip {
		position: absolute;
		left: var(--gutter);
		top: -4rem;
		z-index: 50;
		padding: 0.75rem 1rem;
		background: var(--ink);
		color: var(--bg);
		text-decoration: none;
		font-weight: 600;
	}
	.skip:focus {
		top: 0.5rem;
		--focus: var(--bg);
	}
</style>
