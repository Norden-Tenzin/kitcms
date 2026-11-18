<script lang="ts">
	import '@fontsource-variable/hanken-grotesk';
	import '@fontsource/instrument-serif';
	import '#lib/site/site.css';
	import { dev } from '$app/env';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { designFor } from '#lib/site/content.ts';
	import Shell from '#lib/site/Shell.svelte';
	import { buildShell, themeStyle } from '#lib/site/shell.ts';

	let { data, children } = $props();
	const shell = $derived(buildShell(data.site, data.legal));
	// Dev only: `?header=b` and `?footer=c` preview a design without saving the settings.
	const devParam = (name: string) => (dev ? page.url.searchParams.get(name) : null);
	const header = $derived(designFor('header', data.site, devParam('header')));
	const footer = $derived(designFor('footer', data.site, devParam('footer')));

	// View transitions between pages (skipped for reduced motion and where unsupported).
	onNavigate((navigation) => {
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<Shell {shell} {header} {footer} style={themeStyle(data.site.theme)}>
	{@render children()}
</Shell>
