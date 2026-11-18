<script lang="ts">
	// The menu on small screens. With script it is a native modal <dialog> (focus trap, Escape and
	// focus return come from the platform), `aria-expanded` on the trigger, closed on navigation.
	// Without script the trigger is a plain link to the footer navigation, so every link is reachable.
	import { page } from '$app/state';
	import Icon from '../Icon.svelte';
	import Link from '../Link.svelte';
	import { isActive, telHref, type Shell } from '../shell';

	let { shell, class: className, always = false }: { shell: Shell; class?: string; always?: boolean } = $props();
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

<button type="button" class={['trigger', 'js-only', className, always && 'always']} aria-expanded={open} aria-controls="site-menu" onclick={show}>
	<Icon name="menu" size={22} /><span>Menu</span>
</button>
<a class={['trigger', 'nojs-only', className, always && 'always']} href="#footer-nav"><Icon name="menu" size={22} /><span>Menu</span></a>

<dialog
	id="site-menu"
	bind:this={dialog}
	aria-label="Menu"
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && hide()}
>
	<div class="panel inverse">
		<div class="top">
			<span class="name">{shell.siteName}</span>
			<button type="button" class="close" onclick={hide}><Icon name="close" size={22} /><span>Close</span></button>
		</div>
		<nav aria-label="Main">
			{#each shell.nav as item (item.id)}
				<Link href={item.href} aria-current={isActive(item.href, page.url.pathname) ? 'page' : undefined}>{item.label}</Link>
			{/each}
		</nav>
		<div class="foot">
			<Link href={shell.cta.href} class="btn light">{shell.cta.label}</Link>
			{#if shell.contact.email}<Link class="link" href={`mailto:${shell.contact.email}`}>{shell.contact.email}</Link>{/if}
			{#if shell.contact.phone}<Link class="link" href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
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
		padding: 0 0.5rem;
		border: 0;
		background: none;
		color: inherit;
		font: 600 var(--step-0) var(--font-text);
		text-decoration: none;
		cursor: pointer;
	}
	/* Script on: the button; script off: the link. */
	:global(html:not(.js)) .js-only,
	:global(html.js) .nojs-only {
		display: none;
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
		color: var(--bg);
	}
	dialog::backdrop {
		background: var(--ink);
	}
	.panel {
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-height: 100%;
		padding: var(--gutter);
		overflow-y: auto;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 3rem;
	}
	.name {
		font: 1.6rem/1 var(--font-display);
	}
	.close {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0 0.5rem;
		border: 0;
		background: none;
		color: inherit;
		font: 600 var(--step-0) var(--font-text);
		cursor: pointer;
	}
	nav {
		display: grid;
		align-content: center;
		gap: 0.25rem;
		padding-block: var(--s-5);
	}
	nav :global(a) {
		font: clamp(2.4rem, 1.6rem + 4vw, 3.6rem) / 1.1 var(--font-display);
		text-decoration: none;
		padding-block: 0.15em;
		min-height: 2.75rem;
	}
	nav :global(a[aria-current]) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.18em;
	}
	.foot {
		display: grid;
		gap: 0.25rem;
		justify-items: start;
	}
	.foot :global(.btn) {
		margin-bottom: var(--s-3);
	}
	.foot :global(.link) {
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
	}
</style>
