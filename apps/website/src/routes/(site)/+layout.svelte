<script lang="ts">
	import '../../app.css';
	import '#lib/site.css';
	import Footer from '#lib/Footer.svelte';
	import Header from '#lib/Header.svelte';
	import { buildShell } from '#lib/shell.ts';
	import { themeStyle } from '#lib/theme.ts';

	let { data, children } = $props();
	const shell = $derived(buildShell(data.site));
</script>

<div class="site" style={themeStyle(data.site.theme)}>
	<a class="skip" href="#main">Skip to content</a>
	<Header {shell} />
	<main id="main">{@render children()}</main>
	<Footer {shell} />
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
		padding: 0.75rem 1.25rem;
		background: var(--fg);
		color: var(--bg);
		border-radius: 999px;
		font-weight: 650;
		text-decoration: none;
	}
	.skip:focus {
		top: 0.5rem;
	}
</style>
