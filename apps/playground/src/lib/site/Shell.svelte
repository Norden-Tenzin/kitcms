<script lang="ts">
	// The page frame: skip link, announcement, header, footer and the mobile bar, each in the design
	// the site settings pick. Pages render inside `children`.
	import type { Snippet } from 'svelte';
	import type { DesignId } from './designs';
	import Announcement from './header/Announcement.svelte';
	import HeaderA from './header/HeaderA.svelte';
	import HeaderB from './header/HeaderB.svelte';
	import HeaderC from './header/HeaderC.svelte';
	import StickyCta from './header/StickyCta.svelte';
	import FooterA from './footer/FooterA.svelte';
	import FooterB from './footer/FooterB.svelte';
	import FooterC from './footer/FooterC.svelte';
	import type { Shell } from './shell';

	interface Props {
		shell: Shell;
		header: DesignId;
		footer: DesignId;
		/** The page opens on a full-bleed photograph (header design C then uses light type). */
		overHero?: boolean;
		style?: string;
		children: Snippet;
	}
	let { shell, header, footer, overHero = false, style, children }: Props = $props();
</script>

<div class="site" data-header={header} {style}>
	<a class="skip" href="#main">Skip to content</a>
	<Announcement {shell} />
	{#if header === 'c'}
		<!-- Header C floats over the page: its anchor sits below the announcement bar. -->
		<div class="float"><HeaderC {shell} {overHero} /></div>
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
	<StickyCta {shell} />
</div>

<style>
	.float {
		position: relative;
		z-index: 10;
	}
	.skip {
		position: absolute;
		left: var(--gutter);
		top: -4rem;
		z-index: 50;
		padding: 0.75rem 1rem;
		background: var(--ink);
		color: var(--bg);
		border-radius: var(--radius);
		text-decoration: none;
		font-weight: 600;
	}
	.skip:focus {
		top: 0.5rem;
	}
</style>
