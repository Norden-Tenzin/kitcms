<script lang="ts">
	// A "Simple": the name and one sentence on the left, the links on the right, a quiet last line.
	import Link from '../Link.svelte';
	import { telHref, type Shell } from '../shell';
	import FooterLinks from './FooterLinks.svelte';

	let { shell }: { shell: Shell } = $props();
	const year = new Date().getFullYear();
</script>

<footer class="surface">
	<div class="container top">
		<div class="about">
			<p class="name">{shell.siteName}</p>
			{#if shell.footerText}<p class="muted">{shell.footerText}</p>{/if}
		</div>
		<FooterLinks {shell} which="nav" id="footer-nav" />
		<div class="contact">
			{#if shell.contact.email}<Link class="link" href={`mailto:${shell.contact.email}`}>{shell.contact.email}</Link>{/if}
			{#if shell.contact.phone}<Link class="link" href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
		</div>
	</div>
	<div class="container last small muted">
		<p>&copy; {year} {shell.siteName}</p>
		<FooterLinks {shell} which="legal" />
	</div>
</footer>

<style>
	footer {
		padding-block: var(--s-6) var(--s-4);
	}
	.top {
		display: grid;
		gap: var(--s-5);
	}
	.name {
		font: var(--step-h3) / 1 var(--font-display);
		margin-bottom: var(--s-3);
	}
	.about .muted {
		max-width: 28rem;
	}
	.contact {
		display: grid;
		justify-items: start;
		align-content: start;
	}
	.contact :global(.link) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}
	.last {
		display: grid;
		gap: var(--s-2);
		margin-top: var(--s-6);
	}
	.last :global(ul) {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-4);
	}
	@media (min-width: 56rem) {
		.top {
			grid-template-columns: 1.4fr 1fr 1fr;
			gap: var(--s-6);
		}
		.last {
			grid-template-columns: 1fr auto;
			align-items: center;
		}
	}
</style>
