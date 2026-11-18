<script lang="ts">
	// TODO(part 3): replace with the enquiry form from @kitcms/plugin-enquiries (prefilled with the
	// room). Until then it links to the contact page and the phone.
	import Link from './Link.svelte';
	import type { Shell } from './shell';
	import { telHref, waHref } from './shell';

	let { shell, room }: { shell: Shell; room: string } = $props();
</script>

<div class="enquiry" id="enquire">
	<h3>Ask about the {room}</h3>
	<p class="small">Tell us your dates and how many are travelling. We answer within a day, usually sooner.</p>
	<div class="actions">
		<Link href={`${shell.cta.href}?room=${encodeURIComponent(room)}`} class="btn">{shell.cta.label}</Link>
		{#if shell.contact.whatsapp}<Link href={waHref(shell.contact.whatsapp)} class="btn ghost">WhatsApp</Link>{/if}
		{#if shell.contact.phone}<Link class="link" href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
	</div>
</div>

<style>
	.enquiry {
		display: grid;
		gap: var(--s-3);
		padding: var(--s-5);
		background: var(--surface);
		border-radius: var(--radius);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3);
		align-items: center;
	}
</style>
