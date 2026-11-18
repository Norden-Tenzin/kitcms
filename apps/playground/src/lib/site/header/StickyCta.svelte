<script lang="ts">
	// Mobile-only bar: always one tap from enquiring. Hidden on the contact page and on desktop.
	import { page } from '$app/state';
	import Link from '../Link.svelte';
	import { telHref, type Shell } from '../shell';

	let { shell }: { shell: Shell } = $props();
	const hidden = $derived(page.url.pathname.startsWith('/contact'));
</script>

{#if !hidden}
	<div class="sticky" role="region" aria-label="Quick actions">
		{#if shell.contact.phone}<Link class="btn ghost" href={telHref(shell.contact.phone)}>Call</Link>{/if}
		<Link href={shell.cta.href} class="btn">{shell.cta.label}</Link>
	</div>
{/if}

<style>
	.sticky {
		position: fixed;
		inset: auto 0 0;
		z-index: 20;
		display: flex;
		gap: var(--s-3);
		padding: var(--s-3) var(--gutter) calc(var(--s-3) + env(safe-area-inset-bottom));
		background: var(--bg);
	}
	.sticky :global(.btn) {
		flex: 1;
	}
	.sticky :global(.ghost) {
		flex: 0 0 30%;
		color: var(--ink);
	}
	@media (min-width: 56rem) {
		.sticky {
			display: none;
		}
	}
</style>
