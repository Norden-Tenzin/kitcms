---
title: Enquiries plugin
description: Add contact and booking forms defined in code, with spam protection and email notification, using @kitcms/plugin-enquiries.
order: 3
---

This page covers `@kitcms/plugin-enquiries`: defining forms, the submissions collection, spam protection, the Svelte component and the security model.

```sh
pnpm add @kitcms/plugin-enquiries
```

Forms are defined in code, so editors cannot change what a form asks. Submissions are stored in a locked-down collection. Staff can be notified by email.

## Define forms

```ts title="src/kitcms.config.ts"
import { defineConfig } from '@kitcms/core';
import { enquiries } from '@kitcms/plugin-enquiries';

export default defineConfig({
	email: { from: { address: 'no-reply@example.com', name: 'Acme' } },
	collections: [/* ... */],
	plugins: [
		enquiries({
			forms: {
				contact: {
					label: 'Contact form',
					notify: ['hello@example.com'],
					subject: 'Message from {field:name}',
					replyTo: 'email',
					fields: {
						name: { type: 'text', required: true, maxLength: 80 },
						email: { type: 'email', required: true },
						message: { type: 'textarea', required: true },
						consent: { type: 'checkbox', required: true },
					},
				},
			},
		}),
	],
});
```

The plugin adds a `submissions` collection. Run `pnpm db:generate <name>` and `pnpm db:migrate`.

| Option | Default | What it does |
|---|---|---|
| `forms` | required | Form name (lowercase letters, digits and `-`, starting with a letter) mapped to `{ label, fields, notify?, subject?, replyTo? }`. |
| `collection` | `'submissions'` | Slug of the submissions collection. |
| `turnstile` | off | `{ siteKey, secret? }`. `secret` is the name of the Worker secret. Default `TURNSTILE_SECRET`. |
| `rateLimit` | `{ max: 5, window: 600 }` | Per IP address, counted in D1. `window` is in seconds. |
| `entitlement` | none | Gate the plugin and its collection behind an add-on. |

### Field types

`text` (max 200), `textarea` (max 5000), `email`, `number` (`min`, `max`, `integer`), `date` (`YYYY-MM-DD`), `select` (`options`) and `checkbox` (`required` means it must be checked). Unknown keys in a submission are dropped.

`subject` accepts `{form}` (the form label) and `{field:name}`. Line breaks are removed from values.

## Email

Set `email` in the config and add the `send_email` binding. Without them, submissions are stored but not emailed. See [Email](../auth/email.md). An email failure never fails the submission.

## Turnstile

For Cloudflare Turnstile, pass the site key and store the secret:

```sh
pnpm exec wrangler secret put TURNSTILE_SECRET
```

Locally, put `TURNSTILE_SECRET=1x0000000000000000000000000000000AA` in `.dev.vars` and use the site key `1x00000000000000000000AA`. Those are Cloudflare's always-pass test keys. If Turnstile is configured but the secret is missing, submissions are rejected with a 500 (fail closed).

## On the site

```svelte title="src/routes/contact/+page.svelte"
<script lang="ts">
	import { page } from '$app/state';
	import { EnquiryForm, fieldError } from '@kitcms/plugin-enquiries/svelte';
</script>

<EnquiryForm form="contact" page={page.url.pathname}>
	{#snippet children(enquiry)}
		<label for="name">Name</label>
		<input
			id="name"
			name="name"
			required
			aria-invalid={fieldError(enquiry, 'name') ? 'true' : undefined}
			aria-describedby={fieldError(enquiry, 'name') ? 'name-error' : undefined}
		/>
		{#if fieldError(enquiry, 'name')}<p id="name-error">{fieldError(enquiry, 'name')}</p>{/if}

		<label for="email">Email</label>
		<input id="email" name="email" type="email" required />

		<label for="message">Message</label>
		<textarea id="message" name="message" required></textarea>

		<label><input type="checkbox" name="consent" required /> I agree to be contacted</label>

		<button disabled={enquiry.status === 'submitting'}>Send</button>
	{/snippet}
</EnquiryForm>
```

The component renders the `<form method="post">`, a hidden honeypot, the Turnstile widget and an `aria-live` status region. You render the fields. Props: `form`, `action` (default `/api/plugins/enquiries/submit/<form>`; pass a base-prefixed URL when your app has a base path), `turnstileSiteKey`, `page` and `class`.

**Without JavaScript**, the form posts normally and the server answers `303` back to `page` (or a same-origin Referer) with `?enquiry=sent` or `?enquiry=error&fields=name,email`.

**From any client**: `POST /api/plugins/enquiries/submit/<form>` with `application/json` (the Turnstile token as `turnstileToken`) or a form body (`cf-turnstile-response`). Same-origin only. Success is `{ ok: true, message }`. Errors are `400 { error, errors: [{ path, message }] }`. `GET /api/plugins/enquiries/forms/<form>` returns the public definition of a form.

## Security

- Only the endpoint can create submissions. `read`, `update` and `delete` are for admins (`role === 'admin'`), and `create` is denied for everyone through REST, RPC and the Local API. Admins can change only `status`.
- No IP addresses are stored. The IP is used for rate limiting and Turnstile.
- A filled honeypot gets a success response and nothing is stored.
- Strict validation against the form in code. No file uploads. Bodies are capped at 16 KiB.
- Cross-origin POSTs are refused by core. The redirect target for no-JavaScript posts must be a same-origin relative path, otherwise `/`.
- In email, user values are HTML-escaped, and neither the subject nor the reply-to can inject headers.
