<script lang="ts">
	import '../../app.css';
	import { dev } from '$app/env';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { resolveDesign, themeStyle } from '#lib/designs.ts';
	import Footer from '#lib/shell/Footer.svelte';
	import Header from '#lib/shell/Header.svelte';
	import { buildShell } from '#lib/shell/shell.ts';

	let { data, children } = $props();
	const shell = $derived(buildShell(data.site, data.legal));
	// Dev only: `?header=b` and `?footer=c` preview a design without saving the settings.
	const preview = (name: 'header' | 'footer') => (dev ? page.url.searchParams.get(name) : null);
	const header = $derived(resolveDesign('header', data.site.design, preview('header')));
	const footer = $derived(resolveDesign('footer', data.site.design, preview('footer')));

	// View transitions between pages (skipped for reduced motion and where unsupported).
	onNavigate((navigation) => {
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches)
			return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<div class="site" style={themeStyle(data.site.theme)}>
	<a class="skip" href="#main">Skip to content</a>
	<Header {shell} design={header} />
	<main id="main">{@render children()}</main>
	<Footer {shell} design={footer} />
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
		border-radius: var(--radius);
		font-weight: 600;
		text-decoration: none;
	}
	.skip:focus {
		top: 0.5rem;
		--focus: var(--bg);
	}
</style>
