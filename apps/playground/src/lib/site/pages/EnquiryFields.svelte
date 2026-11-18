<script lang="ts">
	// The studio's two enquiry forms (plugin-enquiries) in the site's style: `brief` (a project brief) and
	// `contact` (name, email, message). Without script the form posts normally and the server answers with
	// a 303 back to `/contact?form=<form>&enquiry=sent|error&fields=...`, which is read here; with script it
	// posts in the background and shows the result in place. `?form=` says which of the two forms the result
	// belongs to (both can be on one page).
	import { page } from '$app/state';
	import { EnquiryForm, fieldError } from '@kitcms/plugin-enquiries/svelte';
	import { BUDGET_OPTIONS, SERVICE_OPTIONS, TIMELINE_OPTIONS } from '../enquiry';
	import { TURNSTILE_SITE_KEY } from '../turnstile';

	let {
		form,
		service = '',
		id = form,
	}: {
		form: 'brief' | 'contact';
		/** A service slug to preselect (`?service=`). */
		service?: string;
		/** Prefix for input ids (two forms on one page need different ones). */
		id?: string;
	} = $props();

	const selected = $derived(SERVICE_OPTIONS.some((o) => o.value === service) ? service : '');
	const mine = $derived(page.url.searchParams.get('form') === form);
	const result = $derived(mine ? page.url.searchParams.get('enquiry') : null);
	const badFields = $derived(mine ? (page.url.searchParams.get('fields') ?? '').split(',').filter(Boolean) : []);
	// Where the no-JS redirect lands: this page, tagged with the form, keeping the preselected service.
	const here = $derived(`${page.url.pathname}?form=${form}${selected && form === 'brief' ? `&service=${selected}` : ''}`);
	const SENT = 'Thanks, your message has been sent. We reply within one working day.';
</script>

<div class="enq">
	{#if result === 'sent'}
		<p class="done" role="status">{SENT}</p>
	{:else}
		<EnquiryForm {form} page={here} turnstileSiteKey={TURNSTILE_SITE_KEY} class="f">
			{#snippet children(enquiry)}
				{#if enquiry.status === 'success'}
					<p class="done">{SENT}</p>
					<button type="button" class="btn ghost" onclick={enquiry.reset}>Send another</button>
				{:else}
					{#if result === 'error'}
						<p class="err" role="alert">Please check the form{badFields.length ? `: ${badFields.join(', ')}` : ''}.</p>
					{/if}
					{#snippet err(name: string)}
						{#if fieldError(enquiry, name)}<span class="msg" id="{id}-{name}-e">{fieldError(enquiry, name)}</span>{/if}
					{/snippet}

					<div class="row">
						<div class="field">
							<label for="{id}-name">Name</label>
							<input id="{id}-name" name="name" autocomplete="name" required maxlength="80" aria-invalid={fieldError(enquiry, 'name') || badFields.includes('name') ? 'true' : undefined} aria-describedby={fieldError(enquiry, 'name') ? `${id}-name-e` : undefined} />
							{@render err('name')}
						</div>
						<div class="field">
							<label for="{id}-email">Email</label>
							<input id="{id}-email" name="email" type="email" autocomplete="email" required aria-invalid={fieldError(enquiry, 'email') || badFields.includes('email') ? 'true' : undefined} aria-describedby={fieldError(enquiry, 'email') ? `${id}-email-e` : undefined} />
							{@render err('email')}
						</div>
					</div>

					{#if form === 'brief'}
						<div class="row">
							<div class="field">
								<label for="{id}-company">Company</label>
								<input id="{id}-company" name="company" autocomplete="organization" maxlength="120" placeholder="Optional" />
							</div>
							<div class="field">
								<label for="{id}-service">Service</label>
								<select id="{id}-service" name="service" value={selected}>
									<option value="">Not sure yet</option>
									{#each SERVICE_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
								</select>
							</div>
						</div>
						<div class="row">
							<div class="field">
								<label for="{id}-budget">Budget</label>
								<select id="{id}-budget" name="budget">
									<option value="">Prefer not to say</option>
									{#each BUDGET_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
								</select>
							</div>
							<div class="field">
								<label for="{id}-timeline">Timeline</label>
								<select id="{id}-timeline" name="timeline">
									<option value="">Not decided</option>
									{#each TIMELINE_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
								</select>
							</div>
						</div>
					{/if}

					<div class="field">
						<label for="{id}-message">Message</label>
						<textarea id="{id}-message" name="message" rows={form === 'brief' ? 6 : 5} required maxlength="5000" aria-invalid={fieldError(enquiry, 'message') || badFields.includes('message') ? 'true' : undefined} aria-describedby={fieldError(enquiry, 'message') ? `${id}-message-e` : undefined}></textarea>
						{@render err('message')}
					</div>

					{#if form === 'brief'}
						<label class="check">
							<input type="checkbox" name="consent" required />
							<span>Halden Studio may contact me about this enquiry.</span>
						</label>
					{/if}

					{#if enquiry.status === 'error' && enquiry.message}<p class="err" role="alert">{enquiry.message}</p>{/if}
					<button class="btn" disabled={enquiry.status === 'submitting'}>
						{enquiry.status === 'submitting' ? 'Sending' : form === 'brief' ? 'Send brief' : 'Send message'}
					</button>
				{/if}
			{/snippet}
		</EnquiryForm>
	{/if}
</div>

<style>
	.enq {
		--err-ink: #a3261d;
		min-width: 0;
		container-type: inline-size;
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
		min-width: 0;
	}
	.field label {
		font-weight: 600;
		font-size: var(--step-small);
	}
	.field input,
	.field select,
	.field textarea {
		font: 400 1.0625rem/1.3 var(--font-text);
		color: var(--ink);
		background: var(--field, var(--surface));
		border: 0;
		border-bottom: 2px solid var(--ink);
		border-radius: 0;
		min-height: 3rem;
		padding: 0.6rem 0.8rem;
		width: 100%;
		min-width: 0;
	}
	.field textarea {
		resize: vertical;
	}
	.field input[aria-invalid='true'],
	.field textarea[aria-invalid='true'] {
		border-bottom-color: var(--err-ink);
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
	.enq :global(.btn) {
		justify-self: start;
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
