<script lang="ts">
	import '@fontsource/barlow/400.css';
	import '@fontsource/barlow/500.css';
	import '@fontsource/barlow/600.css';
	import '@fontsource/barlow-condensed/700.css';
	import '#lib/site/site.css';
	import { dev } from '$app/env';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { designFor } from '#lib/site/content.ts';
	import Shell from '#lib/site/Shell.svelte';
	import { buildShell, themeStyle } from '#lib/site/shell.ts';

	let { data, children } = $props();
	const shell = $derived(buildShell(data.site, data.legal));
	// Dev only: `?header=b` / `?footer=c` preview a header or footer design without saving settings.
	const devParam = (name: string) => (dev ? page.url.searchParams.get(name) : null);
	const header = $derived(designFor('header', data.site, devParam('header')));
	const footer = $derived(designFor('footer', data.site, devParam('footer')));
	const overHero = $derived(Boolean((page.data as { overHero?: boolean }).overHero));

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

<Shell {shell} {header} {footer} {overHero} style={themeStyle(data.site.theme)}>
	{@render children()}
</Shell>
