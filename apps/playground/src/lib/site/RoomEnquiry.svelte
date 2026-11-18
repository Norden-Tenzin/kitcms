<script lang="ts">
	// The booking enquiry on a room page (all three room designs): the room is fixed, the rest short.
	import BookingForm from './BookingForm.svelte';
	import type { Shell } from './shell';
	import { telHref, waHref } from './shell';
	import Link from './Link.svelte';

	let { shell, room, title = true }: { shell: Shell; room: { name?: string; slug?: string | null }; title?: boolean } = $props();
</script>

<div class="enquiry" id="enquire">
	{#if title}<h3>Ask about the {room.name}</h3>{/if}
	<p class="small">Tell us your dates and how many are travelling. We answer within a day, usually sooner.</p>
	<BookingForm compact room={room.slug ?? ""} id="room" />
	{#if shell.contact.whatsapp || shell.contact.phone}
		<p class="alt small">
			Prefer to talk?
			{#if shell.contact.whatsapp}<Link class="link" href={waHref(shell.contact.whatsapp)}>WhatsApp</Link>{/if}
			{#if shell.contact.phone}<Link class="link" href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
		</p>
	{/if}
</div>

<style>
	.enquiry {
		display: grid;
		gap: var(--s-4);
		padding: var(--s-5);
		background: var(--surface);
		border-radius: var(--radius);
		min-width: 0;
		scroll-margin-top: calc(var(--header-h) + var(--s-4));
	}
	.alt {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		align-items: center;
	}
</style>
