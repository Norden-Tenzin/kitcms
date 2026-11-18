<script lang="ts">
	// The mobile menu: a native modal <dialog>, so the platform handles the focus trap, Escape and
	// returning focus to the button. `aria-expanded` mirrors the state; it closes on navigation and
	// on a click outside the panel.
	import { page } from '$app/state';
	import Link from '../Link.svelte';
	import { isActive, type NavItem } from './shell';

	let { nav, label = 'Menu' }: { nav: NavItem[]; label?: string } = $props();
	let dialog = $state<HTMLDialogElement>();
	let open = $state(false);

	const show = () => {
		dialog?.showModal();
		open = true;
	};
	const hide = () => dialog?.close();
	$effect(() => {
		void page.url.pathname;
		if (dialog?.open) dialog.close();
	});
</script>

<button type="button" class="trigger" aria-expanded={open} aria-controls="site-menu" onclick={show}>
	<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
	<span>{label}</span>
</button>

<dialog
	id="site-menu"
	bind:this={dialog}
	aria-label={label}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && hide()}
>
	<div class="panel">
		<button type="button" class="close" onclick={hide}>
			<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
			<span>Close</span>
		</button>
		<nav aria-label="Main">
			{#each nav as item (item.id)}
				<Link href={item.href} aria-current={isActive(item.href, page.url.pathname) ? 'page' : undefined}>
					{item.label}
				</Link>
			{/each}
		</nav>
	</div>
</dialog>

<style>
	svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
	.trigger,
	.close {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		min-width: 2.75rem;
		padding: 0 0.75rem;
		margin-right: -0.75rem;
		border: 0;
		background: none;
		color: inherit;
		font: 600 1rem var(--font-sans);
		cursor: pointer;
	}
	.close {
		align-self: flex-end;
	}
	dialog {
		inset: 0;
		width: 100%;
		max-width: none;
		height: 100%;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--ink);
		font-family: var(--font-sans);
		--focus: var(--ink);
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	.panel {
		position: absolute;
		inset: 0 0 0 auto;
		width: min(100%, 26rem);
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-2) var(--gutter) var(--s-5);
		overflow-y: auto;
		background: var(--bg);
	}
	nav {
		display: flex;
		flex-direction: column;
	}
	nav :global(a) {
		display: flex;
		align-items: center;
		min-height: 3.25rem;
		padding: 0.35rem 0;
		font: 650 1.625rem/1.2 var(--font-display);
		letter-spacing: -0.02em;
		text-decoration: none;
	}
	nav :global(a[aria-current]) {
		color: var(--accent);
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.3em;
	}
	@media (prefers-reduced-motion: no-preference) {
		dialog[open] .panel {
			animation: slide 0.3s var(--ease);
		}
		dialog[open]::backdrop {
			animation: fade 0.3s var(--ease);
		}
	}
	@keyframes slide {
		from {
			transform: translateX(2rem);
			opacity: 0;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
