<script lang="ts">
	import Link from '#lib/site/Link.svelte';
	import PageHead from '#lib/site/PageHead.svelte';
	import Seo from '#lib/site/Seo.svelte';
	import { buildShell, telHref, waHref } from '#lib/site/shell.ts';

	// Placeholder. TODO(part 3): the enquiry form from @kitcms/plugin-enquiries goes where "form" is,
	// prefilled from `?room=`. `data.design` is already resolved for the three contact designs.
	let { data } = $props();
	const shell = $derived(buildShell(data.site, data.legal));
</script>

<Seo title="Contact" description="Write to us, call, or message on WhatsApp." siteName={data.site.siteName} />
<PageHead title="Contact" lead="Write, call or message us. We answer within a day, usually sooner." />
<div class="container body" data-design={data.design}>
	<div class="info">
		{#if shell.contact.address}<address>{shell.contact.address}</address>{/if}
		{#if shell.contact.phone}<Link class="link" href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
		{#if shell.contact.whatsapp}<Link href={waHref(shell.contact.whatsapp)} class="link">WhatsApp</Link>{/if}
		{#if shell.contact.email}<Link class="link" href={`mailto:${shell.contact.email}`}>{shell.contact.email}</Link>{/if}
		{#if shell.season}<p class="small">{shell.season}</p>{/if}
		{#if shell.checkIn}<p class="small">Check-in {shell.checkIn}, check-out {shell.checkOut}</p>{/if}
	</div>
	<div id="form" class="form"><p>The enquiry form arrives with the enquiries plugin.</p></div>
</div>

<style>
	.body {
		display: grid;
		gap: var(--s-6);
		padding-top: var(--s-5);
	}
	.info {
		display: grid;
		gap: var(--s-2);
		justify-items: start;
		align-content: start;
	}
	address {
		font-style: normal;
		white-space: pre-line;
		margin-bottom: var(--s-3);
	}
	.form {
		background: var(--surface);
		padding: var(--s-6);
		border-radius: var(--radius);
	}
	@media (min-width: 56rem) {
		.body {
			grid-template-columns: 5fr 6fr;
			gap: var(--s-8, 6rem);
		}
	}
</style>
