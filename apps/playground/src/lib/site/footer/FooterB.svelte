<script lang="ts">
	// B "Columns": four labelled columns (about, explore, studio, follow) on a tinted ground.
	import Link from '../Link.svelte';
	import { telHref, type Shell } from '../shell';
	import FooterLinks from './FooterLinks.svelte';

	let { shell }: { shell: Shell } = $props();
	const year = new Date().getFullYear();
</script>

<footer class="surface-2">
	<div class="container cols">
		<div class="about">
			<p class="name">{shell.siteName}</p>
			{#if shell.tagline}<p class="small">{shell.tagline}</p>{/if}
		</div>
		<div>
			<h2>Explore</h2>
			<FooterLinks {shell} which="nav" id="footer-nav" />
		</div>
		<div>
			<h2>Studio</h2>
			<address>
				{#if shell.contact.address}<p>{shell.contact.address}</p>{/if}
				{#if shell.contact.hours}<p class="muted">{shell.contact.hours}</p>{/if}
				{#if shell.contact.email}<Link class="link" href={`mailto:${shell.contact.email}`}>{shell.contact.email}</Link>{/if}
				{#if shell.contact.phone}<Link class="link" href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
			</address>
		</div>
		<div>
			<h2>Follow</h2>
			<FooterLinks {shell} which="social" />
			<h2 class="legal-h">Legal</h2>
			<FooterLinks {shell} which="legal" />
		</div>
	</div>
	<p class="container small muted copy">&copy; {year} {shell.siteName}. {shell.footerText}</p>
</footer>

<style>
	footer {
		background: var(--surface-2);
		padding-block: var(--s-6) var(--s-4);
	}
	.cols {
		display: grid;
		gap: var(--s-5);
	}
	.name {
		font: var(--step-h3) / 1 var(--font-display);
		margin-bottom: var(--s-3);
	}
	h2 {
		font: 600 var(--step-small) / 1.3 var(--font-text);
		letter-spacing: 0;
		margin-bottom: var(--s-2);
	}
	.legal-h {
		margin-top: var(--s-4);
	}
	address {
		font-style: normal;
		display: grid;
		gap: var(--s-2);
		justify-items: start;
		white-space: pre-line;
	}
	address :global(.link) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}
	.copy {
		margin-top: var(--s-6);
	}
	@media (min-width: 56rem) {
		.cols {
			grid-template-columns: 1.3fr 1fr 1.2fr 1fr;
			gap: var(--s-5);
		}
	}
</style>
