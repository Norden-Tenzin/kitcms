<script lang="ts">
	// The enquiry form (plugin-enquiries) in the site's style. `form="booking"` is the full booking
	// enquiry; `compact` is the short version for a room page's side panel (the room is fixed);
	// `form="contact"` is name, email and message. Without JavaScript it posts normally and the server
	// redirects back with `?enquiry=sent|error&fields=...`, which is read here.
	import { page } from '$app/state';
	import { EnquiryForm, fieldError } from '@kitcms/plugin-enquiries/svelte';
	import { prefillMessage, ROOM_OPTIONS, roomValue } from './enquiry';
	import { TURNSTILE_SITE_KEY } from './turnstile';

	let {
		form = 'booking',
		room = '',
		offer = '',
		experience = '',
		compact = false,
		dark = false,
		id = 'enq',
	}: {
		form?: 'booking' | 'contact';
		/** A room slug or name to preselect. */
		room?: string;
		/** An offer slug, turned into the first line of the message. */
		offer?: string;
		/** An experience slug, likewise. */
		experience?: string;
		compact?: boolean;
		/** On a slate or earth field: error text uses the apricot. */
		dark?: boolean;
		/** Prefix for input ids (two forms on one page need different ones). */
		id?: string;
	} = $props();

	const selected = $derived(roomValue(room));
	const roomLabel = $derived(ROOM_OPTIONS.find((o) => o.value === selected)?.label ?? '');
	const intro = $derived(prefillMessage({ offer, experience }));
	// No-JS result, from the redirect.
	const result = $derived(page.url.searchParams.get('enquiry'));
	const badFields = $derived((page.url.searchParams.get('fields') ?? '').split(',').filter(Boolean));
	const here = $derived(page.url.pathname + (page.url.searchParams.has('room') ? `?room=${encodeURIComponent(room)}` : ''));
</script>

<div class="enq" class:dark>
	{#if result === 'sent'}
		<p class="done" role="status">Thank you. Your message has been sent. We answer within a day, usually sooner.</p>
	{:else}
		<EnquiryForm {form} page={here} turnstileSiteKey={TURNSTILE_SITE_KEY} class="f">
			{#snippet children(enquiry)}
				{#if enquiry.status === 'success'}
					<p class="done">{enquiry.message}</p>
					<button type="button" class="btn ghost" onclick={enquiry.reset}>Send another</button>
				{:else}
					{#if result === 'error'}
						<p class="err" role="alert">Please check the form{badFields.length ? `: ${badFields.join(', ')}` : ''}.</p>
					{/if}
					{#snippet err(name: string)}
						{#if fieldError(enquiry, name)}<span class="msg" id="{id}-{name}-e">{fieldError(enquiry, name)}</span>{/if}
					{/snippet}

					<div class="row">
						<label class="field">
							<span>Name</span>
							<input name="name" autocomplete="name" required maxlength="80" aria-invalid={fieldError(enquiry, 'name') || badFields.includes('name') ? 'true' : undefined} aria-describedby={fieldError(enquiry, 'name') ? `${id}-name-e` : undefined} />
							{@render err('name')}
						</label>
						<label class="field">
							<span>Email</span>
							<input name="email" type="email" autocomplete="email" required aria-invalid={fieldError(enquiry, 'email') || badFields.includes('email') ? 'true' : undefined} aria-describedby={fieldError(enquiry, 'email') ? `${id}-email-e` : undefined} />
							{@render err('email')}
						</label>
					</div>

					{#if form === 'booking'}
						{#if !compact}
							<label class="field">
								<span>Phone or WhatsApp <em>(optional)</em></span>
								<input name="phone" type="tel" autocomplete="tel" maxlength="30" />
							</label>
						{/if}
						<div class="row">
							<label class="field">
								<span>Arrive</span>
								<input name="checkIn" type="date" required aria-invalid={fieldError(enquiry, 'checkIn') ? 'true' : undefined} />
								{@render err('checkIn')}
							</label>
							<label class="field">
								<span>Leave</span>
								<input name="checkOut" type="date" required aria-invalid={fieldError(enquiry, 'checkOut') ? 'true' : undefined} />
								{@render err('checkOut')}
							</label>
						</div>
						<div class="row">
							<label class="field">
								<span>Guests</span>
								<input name="guests" type="number" inputmode="numeric" min="1" max="12" value="2" required aria-invalid={fieldError(enquiry, 'guests') ? 'true' : undefined} />
								{@render err('guests')}
							</label>
							{#if compact && selected}
								<input type="hidden" name="room" value={selected} />
								<p class="field fixed"><span>Room</span><strong>{roomLabel}</strong></p>
							{:else}
								<label class="field">
									<span>Room</span>
									<select name="room" value={selected}>
										<option value="">No preference</option>
										{#each ROOM_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
									</select>
								</label>
							{/if}
						</div>
					{/if}

					<label class="field">
						<span>Message{#if form === 'booking'} <em>(optional)</em>{/if}</span>
						<textarea name="message" rows={compact ? 3 : 5} required={form === 'contact'} maxlength="5000" aria-invalid={fieldError(enquiry, 'message') ? 'true' : undefined}>{intro}</textarea>
						{@render err('message')}
					</label>

					{#if form === 'booking'}
						<label class="check">
							<input type="checkbox" name="consent" required />
							<span>Dolkar House may contact me about this enquiry.</span>
						</label>
					{/if}

					{#if enquiry.status === 'error' && enquiry.message}<p class="err" role="alert">{enquiry.message}</p>{/if}
					<button class="btn" disabled={enquiry.status === 'submitting'}>{enquiry.status === 'submitting' ? 'Sending' : form === 'booking' ? 'Send enquiry' : 'Send message'}</button>
				{/if}
			{/snippet}
		</EnquiryForm>
	{/if}
</div>

<style>
	.enq {
		--field-ground: var(--field-bg, var(--bg));
		--err-ink: var(--flag);
		min-width: 0;
		container-type: inline-size;
	}
	.enq.dark {
		--err-ink: var(--apricot);
	}
	.enq :global(.f) {
		display: grid;
		gap: var(--s-4);
		position: relative;
	}
	.row {
		display: grid;
		gap: var(--s-4);
	}
	.field {
		display: grid;
		gap: var(--s-1);
		font-weight: 600;
		font-size: var(--step-small);
		min-width: 0;
	}
	.field em {
		font-weight: 400;
		font-style: normal;
		opacity: 0.8;
	}
	.field input,
	.field select,
	.field textarea {
		font: 400 1.0625rem/1.3 var(--font-text);
		color: var(--ink);
		background: var(--field-ground);
		border: 0;
		border-bottom: 2px solid var(--ink);
		border-radius: var(--radius) var(--radius) 0 0;
		min-height: 3rem;
		padding: 0.6rem 0.8rem;
		width: 100%;
		min-width: 0;
	}
	.field textarea {
		resize: vertical;
	}
	.field input[aria-invalid='true'] {
		border-bottom-color: var(--flag);
	}
	.fixed {
		align-content: end;
	}
	.fixed strong {
		font-weight: 600;
		font-size: 1.0625rem;
		min-height: 3rem;
		display: flex;
		align-items: center;
	}
	.msg,
	.err {
		color: var(--err-ink);
		font-weight: 600;
		font-size: var(--step-small);
	}
	.check {
		display: flex;
		gap: var(--s-3);
		align-items: flex-start;
		font-size: var(--step-small);
		min-height: 2.75rem;
		align-items: center;
	}
	.check input {
		width: 1.4rem;
		height: 1.4rem;
		flex: none;
		accent-color: var(--accent);
	}
	.done {
		font-size: var(--step-lead);
		line-height: 1.35;
		margin-bottom: var(--s-4);
	}
	.enq :global([data-enquiry-status]) {
		font-size: var(--step-small);
		min-height: 0;
	}
	@container (min-width: 26rem) {
		.row {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
