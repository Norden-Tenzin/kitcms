<script lang="ts">
	import { resolve } from '$app/paths';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Link from './Link.svelte';
	import { isActive, type Shell } from './shell';

	let { shell }: { shell: Shell } = $props();

	let open = $state(false);
	afterNavigate(() => {
		open = false;
	});

	// Theme: 'system' (no attribute) -> 'light' -> 'dark'. The saved choice is applied before paint
	// by the inline script in `app.html`; this only mirrors and changes it.
	type Theme = 'system' | 'light' | 'dark';
	let theme = $state<Theme>('system');
	onMount(() => {
		const t = document.documentElement.getAttribute('data-theme');
		theme = t === 'light' || t === 'dark' ? t : 'system';
	});
	function cycle() {
		theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
		const root = document.documentElement;
		if (theme === 'system') root.removeAttribute('data-theme');
		else root.setAttribute('data-theme', theme);
		try {
			if (theme === 'system') localStorage.removeItem('theme');
			else localStorage.setItem('theme', theme);
		} catch {
			// Storage blocked: the choice lasts for this page view only.
		}
	}
	function onKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<header class="header">
	<div class="container bar">
		<a href={resolve('/(site)')} class="brand">{shell.siteName}</a>
		<nav id="site-nav" class="nav" class:open aria-label="Main">
			<ul>
				{#each shell.nav as item (item.id)}
					<li>
						<Link
							href={item.href}
							aria-current={isActive(item.href, page.url.pathname) ? 'page' : undefined}
						>
							{item.label}
						</Link>
					</li>
				{/each}
			</ul>
		</nav>
		<div class="tools">
			<button
				type="button"
				class="tool theme"
				onclick={cycle}
				aria-label="Colour theme: {theme}. Change theme"
				title="Theme: {theme}"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					{#if theme === 'light'}
						<circle cx="12" cy="12" r="4" />
						<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
					{:else if theme === 'dark'}
						<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
					{:else}
						<rect x="3" y="4" width="18" height="12" rx="2" />
						<path d="M8 20h8M12 16v4" />
					{/if}
				</svg>
			</button>
			<button
				type="button"
				class="tool menu"
				aria-expanded={open}
				aria-controls="site-nav"
				onclick={() => (open = !open)}
			>
				{open ? 'Close' : 'Menu'}
			</button>
		</div>
	</div>
</header>

<style>
	.header {
		position: sticky;
		top: 0;
		z-index: 30;
		background: var(--surface);
	}
	.bar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		min-height: var(--header-h);
		gap: 0 0.5rem;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		margin-right: auto;
		font-size: 1.3rem;
		font-weight: 750;
		letter-spacing: -0.03em;
		text-decoration: none;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		padding: 0 0.75rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--fg);
		font: inherit;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
	}
	.tool:hover {
		background: var(--surface-2);
	}
	.menu {
		display: none;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding-inline: 0.75rem;
		border-radius: 999px;
		font-weight: 550;
		text-decoration: none;
	}
	li :global(a:hover) {
		background: var(--surface-2);
	}
	li :global(a[aria-current='page']) {
		color: var(--accent);
	}

	/* Mobile: the links sit in a panel under the bar, behind a toggle (only when scripted). */
	.nav {
		order: 3;
		flex-basis: 100%;
	}
	:global(html.js) .menu {
		display: inline-flex;
	}
	:global(html.js) .nav:not(.open) {
		display: none;
	}
	.nav.open {
		padding-bottom: 1rem;
	}
	.nav ul {
		flex-direction: column;
	}
	.nav li :global(a) {
		min-height: 3rem;
		width: 100%;
		font-size: 1.25rem;
		font-weight: 650;
	}
	@media (min-width: 48rem) {
		.nav {
			order: 0;
			flex-basis: auto;
			margin-right: 0.5rem;
		}
		:global(html.js) .nav:not(.open) {
			display: block;
		}
		.nav.open {
			padding-bottom: 0;
		}
		.nav ul {
			flex-direction: row;
		}
		.nav li :global(a) {
			min-height: 2.75rem;
			width: auto;
			font-size: inherit;
			font-weight: 550;
		}
		:global(html.js) .menu {
			display: none;
		}
	}
</style>
