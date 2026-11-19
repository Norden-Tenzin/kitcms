<script lang="ts">
	import { tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Link from '#lib/Link.svelte';

	let { data, children } = $props();

	let open = $state(false);
	let mobile = $state(false);
	let menuButton: HTMLButtonElement | undefined = $state();
	let drawer: HTMLElement | undefined = $state();
	let closeButton: HTMLButtonElement | undefined = $state();

	// The sidebar is a drawer below 1024px. Keep this in step with the media query in the styles.
	$effect(() => {
		const query = matchMedia('(max-width: 63.999rem)');
		const sync = () => {
			mobile = query.matches;
			if (!mobile) open = false;
		};
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	async function show() {
		open = true;
		await tick();
		closeButton?.focus();
	}
	function hide(restoreFocus = true) {
		if (!open) return;
		open = false;
		if (restoreFocus) menuButton?.focus();
	}
	afterNavigate(() => {
		hide(false);
	});

	function onKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			hide();
		} else if (event.key === 'Tab' && drawer) {
			// Keep focus inside the open drawer.
			const items = [...drawer.querySelectorAll<HTMLElement>('a[href], button')];
			const first = items[0];
			const last = items[items.length - 1];
			if (!first || !last) return;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="docs">
	<div class="menu-bar">
		<div class="container">
			<button
				bind:this={menuButton}
				type="button"
				class="menu-button"
				aria-expanded={open}
				aria-controls="docs-sidebar"
				onclick={show}
			>
				Menu
			</button>
		</div>
	</div>

	<div class="container grid">
		{#if open}
			<button type="button" class="backdrop" tabindex="-1" aria-label="Close menu" onclick={() => hide()}></button>
		{/if}
		<aside
			id="docs-sidebar"
			class="sidebar"
			class:open
			bind:this={drawer}
			inert={mobile && !open}
			aria-label="Documentation"
		>
			<div class="sidebar-head">
				<span>Documentation</span>
				<button bind:this={closeButton} type="button" class="close" onclick={() => hide()}>Close</button>
			</div>
			<nav aria-label="Docs">
				{#each data.nav as section (section.slug)}
					<h2 class="nav-title">{section.title}</h2>
					<ul>
						{#each section.pages as p (p.path)}
							<li>
								<Link href={p.path} aria-current={page.url.pathname === p.path ? 'page' : undefined}>
									{p.title}
								</Link>
							</li>
						{/each}
					</ul>
				{/each}
			</nav>
		</aside>
		<div class="content" inert={mobile && open}>
			{@render children()}
		</div>
	</div>
</div>

<style>
	.docs {
		--code-bg: var(--surface);
	}

	/* ---- Mobile bar + drawer ---- */
	.menu-bar {
		border-bottom: 1px solid var(--line);
		position: sticky;
		top: 0;
		z-index: 20;
		background: var(--bg);
	}
	.menu-button,
	.close {
		min-height: 2.75rem;
		min-width: 2.75rem;
		padding: 0 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.9375rem;
		cursor: pointer;
	}
	.menu-bar .container {
		padding-block: 0.375rem;
	}
	.grid {
		display: block;
	}
	.sidebar {
		position: fixed;
		inset-block: 0;
		left: 0;
		z-index: 40;
		width: min(20rem, 85vw);
		overflow-y: auto;
		padding: 1rem var(--gutter) 2rem;
		background: var(--bg);
		border-right: 1px solid var(--line);
		visibility: hidden;
		transform: translateX(-100%);
		transition:
			transform 0.2s ease,
			visibility 0s linear 0.2s;
	}
	.sidebar.open {
		visibility: visible;
		transform: none;
		transition: transform 0.2s ease;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 30;
		border: 0;
		background: rgb(0 0 0 / 0.5);
		cursor: default;
	}
	.sidebar-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
		font-weight: 700;
	}
	@media (prefers-reduced-motion: reduce) {
		.sidebar,
		.sidebar.open {
			transition: none;
		}
	}

	/* ---- Sidebar nav ---- */
	.nav-title {
		margin: 1.25rem 0 0.25rem;
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.sidebar ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.sidebar li :global(a) {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 0.75rem;
		border-radius: var(--radius);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.sidebar li :global(a:hover) {
		background: var(--surface);
	}
	.sidebar li :global(a[aria-current='page']) {
		background: var(--surface);
		color: var(--accent);
		font-weight: 600;
	}

	.content {
		min-width: 0;
		padding-block: 1.5rem 4rem;
	}

	/* ---- Desktop: static sidebar ---- */
	@media (min-width: 64rem) {
		.menu-bar,
		.backdrop,
		.close {
			display: none;
		}
		.grid {
			display: grid;
			grid-template-columns: 15rem minmax(0, 1fr);
			gap: 0 clamp(1.5rem, 4vw, 3.5rem);
			align-items: start;
		}
		.sidebar {
			position: sticky;
			top: 0;
			z-index: auto;
			width: auto;
			max-height: 100svh;
			padding: 1.5rem 0 2rem;
			border-right: 0;
			visibility: visible;
			transform: none;
		}
		.sidebar-head {
			display: none;
		}
		.content {
			padding-block: 2.5rem 5rem;
		}
	}

	/* ---- Article prose (the HTML is rendered at build time) ---- */
	.content :global(.doc) {
		max-width: 70ch;
		font-size: 1.0625rem;
	}
	.content :global(.doc > :first-child) {
		margin-top: 0;
	}
	.content :global(.doc h1) {
		font-size: clamp(2rem, 1.4rem + 3vw, 2.75rem);
		margin-bottom: 0.5rem;
	}
	.content :global(.doc h2) {
		font-size: clamp(1.4rem, 1.2rem + 1vw, 1.75rem);
		margin: 2.25em 0 0.6em;
		padding-top: 1.25em;
		border-top: 1px solid var(--line);
		scroll-margin-top: 4.5rem;
	}
	.content :global(.doc h3) {
		font-size: 1.2rem;
		margin: 1.75em 0 0.5em;
		scroll-margin-top: 4.5rem;
	}
	.content :global(.doc h2 .anchor),
	.content :global(.doc h3 .anchor) {
		display: inline-block;
		min-width: 1.5rem;
		margin-left: 0.25rem;
		color: var(--muted);
		text-decoration: none;
		opacity: 0;
	}
	.content :global(.doc h2:hover .anchor),
	.content :global(.doc h3:hover .anchor),
	.content :global(.doc .anchor:focus-visible) {
		opacity: 1;
	}
	@media (hover: none) {
		.content :global(.doc h2 .anchor),
		.content :global(.doc h3 .anchor) {
			opacity: 1;
		}
	}
	.content :global(.doc ul),
	.content :global(.doc ol) {
		padding-left: 1.4em;
		margin: 0 0 1em;
	}
	.content :global(.doc li) {
		margin-bottom: 0.35em;
	}
	.content :global(.doc a:not(.anchor)) {
		color: var(--accent);
	}
	.content :global(.doc blockquote) {
		margin: 1em 0;
		padding: 0.1em 1em;
		border-left: 3px solid var(--accent);
		color: var(--muted);
	}
	.content :global(.doc hr) {
		border: 0;
		border-top: 1px solid var(--line);
		margin: 2em 0;
	}
	.content :global(.doc :not(pre) > code) {
		padding: 0.1em 0.35em;
		background: var(--surface);
		border-radius: 0.25rem;
		font-size: 0.9em;
		overflow-wrap: anywhere;
	}
	.content :global(.doc table) {
		display: block;
		max-width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
		margin: 0 0 1em;
		font-size: 0.9375rem;
	}
	.content :global(.doc th),
	.content :global(.doc td) {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--line);
		text-align: left;
		vertical-align: top;
	}
	.content :global(.doc th) {
		background: var(--surface);
	}

	/* Code blocks */
	.content :global(.code-block) {
		position: relative;
		margin: 0 0 1.25em;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--code-bg);
	}
	.content :global(.code-title) {
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--muted);
		overflow-wrap: anywhere;
	}
	.content :global(.code-block pre) {
		margin: 0;
		padding: 1rem;
		overflow-x: auto;
		background: transparent !important;
		font-size: 0.875rem;
		line-height: 1.6;
		border-radius: var(--radius);
	}
	.content :global(.code-block pre code) {
		font-family: var(--font-mono);
		background: none;
		padding: 0;
	}
	.content :global(.code-block .code-actions) {
		position: absolute;
		top: 0;
		right: 0;
	}
	/* Leave room for the copy button on the first line (and under the title bar when there is one). */
	.content :global(.code-block:not(:has(.code-title)) pre) {
		padding-right: 5.5rem;
	}
	.content :global(.code-block .code-title) {
		padding-right: 5.5rem;
	}
	/* Shiki dual themes: both colour sets are CSS variables; the theme picks one. */
	.content :global(.shiki span) {
		color: var(--shiki-light);
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .content :global(.shiki span) {
			color: var(--shiki-dark);
		}
	}
	:global(:root[data-theme='dark']) .content :global(.shiki span) {
		color: var(--shiki-dark);
	}
</style>
