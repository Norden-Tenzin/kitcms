<script lang="ts">
	// Accessible menu: a native modal <dialog> (focus trap, Escape, focus return come from the platform),
	// `aria-expanded` on the trigger, closed on navigation and on a click outside the panel.
	import { page } from '$app/state';
	import Icon from '../Icon.svelte';
	import Link from '../Link.svelte';
	import { telHref, type Shell } from '../shell';

	let { shell, class: className }: { shell: Shell; class?: string } = $props();
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
	const active = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<button type="button" class={['trigger', className]} aria-expanded={open} aria-controls="site-menu" onclick={show}>
	<Icon name="menu" size={22} /><span>Menu</span>
</button>

<dialog
	id="site-menu"
	bind:this={dialog}
	aria-label="Menu"
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && hide()}
>
	<div class="panel on-dark">
		<button type="button" class="close" onclick={hide}><Icon name="close" size={22} /><span>Close</span></button>
		<nav aria-label="Main">
			{#each shell.nav as item, i (item.id)}
				<Link href={item.href} aria-current={active(item.href) ? 'page' : undefined} style={`--i:${i}`}>{item.label}</Link>
			{/each}
		</nav>
		<div class="foot">
			<Link href={shell.cta.href} class="btn light">{shell.cta.label}</Link>
			{#if shell.contact.phone}<Link class="tel" href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
			{#if shell.season}<p class="small">{shell.season}</p>{/if}
		</div>
	</div>
</dialog>

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		min-width: 2.75rem;
		padding: 0 0.75rem;
		border: 0;
		background: none;
		color: inherit;
		font: 600 1.0625rem var(--font-text);
		cursor: pointer;
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
		color: var(--slate-ink);
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	.panel {
		position: absolute;
		inset: 0 0 0 auto;
		width: min(100%, 34rem);
		display: flex;
		flex-direction: column;
		gap: var(--s-6);
		padding: var(--s-4) var(--gutter) var(--s-6);
		overflow-y: auto;
		background: var(--slate);
		font-family: var(--font-text);
	}
	dialog[open] .panel {
		animation: slide 0.35s var(--ease);
	}
	@keyframes slide {
		from {
			transform: translateX(2.5rem);
			opacity: 0;
		}
	}
	.close {
		align-self: flex-end;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0 0.75rem;
		border: 0;
		background: none;
		color: inherit;
		font: 600 1.0625rem var(--font-text);
		cursor: pointer;
	}
	nav {
		display: flex;
		flex-direction: column;
	}
	nav :global(a) {
		font: 700 clamp(2.4rem, 1.6rem + 4vw, 3.4rem) / 1.1 var(--font-display);
		text-transform: uppercase;
		text-decoration: none;
		padding: 0.15em 0;
		min-height: 2.75rem;
		transition: color 0.2s var(--ease), transform 0.25s var(--ease);
	}
	nav :global(a:hover),
	nav :global(a[aria-current]) {
		color: var(--apricot);
		transform: translateX(0.4rem);
	}
	.foot {
		margin-top: auto;
		display: grid;
		gap: var(--s-4);
		justify-items: start;
	}
	.tel {
		font-weight: 600;
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
	}
</style>
