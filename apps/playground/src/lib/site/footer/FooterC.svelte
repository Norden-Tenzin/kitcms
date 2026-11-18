<script lang="ts">
	// C "Statement": an ink field that closes the page with one large invitation and the email as the
	// biggest link on it. The link lists sit small underneath.
	import Link from '../Link.svelte';
	import { telHref, type Shell } from '../shell';
	import FooterLinks from './FooterLinks.svelte';

	let { shell }: { shell: Shell } = $props();
	const year = new Date().getFullYear();
</script>

<footer class="inverse">
	<div class="container statement">
		<p class="ask">Have something to make?</p>
		{#if shell.contact.email}
			<Link class="mail" href={`mailto:${shell.contact.email}`}>{shell.contact.email}</Link>
		{:else}
			<Link class="mail" href={shell.cta.href}>{shell.cta.label}</Link>
		{/if}
	</div>
	<div class="container lists">
		<FooterLinks {shell} which="nav" id="footer-nav" />
		<div>
			{#if shell.contact.address}<address>{shell.contact.address}</address>{/if}
			{#if shell.contact.phone}<Link class="link phone" href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
		</div>
		<FooterLinks {shell} which="social" />
		<FooterLinks {shell} which="legal" />
	</div>
	<p class="container small muted copy">&copy; {year} {shell.siteName}. {shell.footerText}</p>
</footer>

<style>
	footer {
		padding-block: var(--section) var(--s-4);
	}
	.ask {
		font: var(--step-h3) / 1.1 var(--font-display);
		color: var(--muted);
		margin-bottom: var(--s-3);
	}
	.statement :global(.mail) {
		display: inline-block;
		min-height: 2.75rem;
		font: clamp(2.2rem, 0.8rem + 6.4vw, 7rem) / 1 var(--font-display);
		letter-spacing: -0.02em;
		text-decoration: underline;
		text-decoration-thickness: 3px;
		text-underline-offset: 0.12em;
		text-decoration-color: color-mix(in srgb, var(--bg) 40%, transparent);
		overflow-wrap: anywhere;
		transition: text-decoration-color 0.2s var(--ease);
	}
	.statement :global(.mail:hover) {
		text-decoration-color: var(--bg);
	}
	.lists {
		display: grid;
		gap: var(--s-4);
		margin-top: var(--s-7);
	}
	address {
		font-style: normal;
		white-space: pre-line;
		margin-bottom: var(--s-2);
	}
	.lists :global(.phone) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}
	.copy {
		margin-top: var(--s-6);
	}
	@media (min-width: 56rem) {
		.lists {
			grid-template-columns: repeat(4, 1fr);
			gap: var(--s-5);
		}
	}
</style>
