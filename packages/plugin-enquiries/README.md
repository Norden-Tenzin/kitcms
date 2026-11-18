# @kitcms/plugin-enquiries

Contact and booking forms for kitcms. Forms are defined **in code** (nothing to edit in the admin), submissions are stored in a locked-down collection, spam is blocked with a honeypot, a per-IP rate limit and optional Cloudflare Turnstile, and staff are notified by email.

## Install

```sh
pnpm add @kitcms/plugin-enquiries
```

```ts
// kitcms.config.ts
import { defineConfig } from '@kitcms/core';
import { enquiries } from '@kitcms/plugin-enquiries';

export default defineConfig({
	// email: { ... }  // see the core email docs; without it submissions are stored but not emailed
	plugins: [
		enquiries({
			turnstile: { siteKey: '0x4AAAA...' },
			forms: {
				booking: {
					label: 'Booking request',
					notify: ['reservations@hotel.example'],
					subject: 'Booking request from {field:name}',
					replyTo: 'email',
					fields: {
						name: { type: 'text', required: true, maxLength: 80 },
						email: { type: 'email', required: true },
						arrival: { type: 'date', required: true },
						guests: { type: 'number', min: 1, max: 12, integer: true, required: true },
						room: { type: 'select', options: [{ label: 'Garden room', value: 'garden' }, 'Suite'] },
						message: { type: 'textarea' },
						consent: { type: 'checkbox', required: true },
					},
				},
			},
		}),
	],
});
```

Run `kitcms generate` / migrate as usual: the plugin adds a `submissions` collection (change with `collection`).

### Options

| Option | Default | |
|---|---|---|
| `forms` | required | Form name (`/^[a-z][a-z0-9-]*$/`) to `{ label, fields, notify?, subject?, replyTo? }` |
| `collection` | `'submissions'` | Slug of the submissions collection |
| `turnstile` | off | `{ siteKey, secret? }`. `secret` is the Worker secret name, default `TURNSTILE_SECRET` |
| `rateLimit` | `{ max: 5, window: 600 }` | Per IP, in D1 (seconds) |
| `entitlement` | none | Add-on gate for the plugin and its collection |

Field types: `text` (max 200), `textarea` (max 5000), `email`, `number` (`min`, `max`, `integer`), `date` (`YYYY-MM-DD`), `select`, `checkbox` (`required` = must be checked). Unknown keys in a submission are dropped.

`subject` accepts `{form}` (the form label) and `{field:name}`. Values are stripped of line breaks.

## Cloudflare setup

```jsonc
// wrangler.jsonc
{
	"send_email": [{ "name": "EMAIL" }]   // the binding core's email adapter uses
}
```

```sh
wrangler secret put TURNSTILE_SECRET
```

Turnstile test keys for local development (always pass / always block):

- site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (passes)
- site key `2x00000000000000000000AB`, secret `2x0000000000000000000000000000000AA` (fails)

Set the secret in `.dev.vars`: `TURNSTILE_SECRET=1x0000000000000000000000000000000AA`. If Turnstile is configured but the secret is missing, submissions are rejected with a 500 (fail closed).

## Using it in Svelte

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { EnquiryForm, fieldError } from '@kitcms/plugin-enquiries/svelte';
</script>

<EnquiryForm form="booking" page={page.url.pathname} turnstileSiteKey="0x4AAAA...">
	{#snippet children(enquiry)}
		<label for="name">Name</label>
		<input
			id="name" name="name" required
			aria-invalid={fieldError(enquiry, 'name') ? 'true' : undefined}
			aria-describedby={fieldError(enquiry, 'name') ? 'name-error' : undefined}
		/>
		{#if fieldError(enquiry, 'name')}<p id="name-error">{fieldError(enquiry, 'name')}</p>{/if}

		<label for="email">Email</label>
		<input id="email" name="email" type="email" required />

		<label><input type="checkbox" name="consent" required /> I agree to be contacted</label>

		<button disabled={enquiry.status === 'submitting'}>Send</button>
		{#if enquiry.status === 'success'}<button type="button" onclick={enquiry.reset}>Send another</button>{/if}
	{/snippet}
</EnquiryForm>
```

The component renders the `<form method="post">`, a hidden honeypot, the Turnstile widget and an `aria-live` status region (`[data-enquiry-status]`). You render the fields. Props: `form`, `action` (default `/api/plugins/enquiries/submit/<form>`, pass a base-prefixed URL when your app has a base path), `turnstileSiteKey`, `page`, `class`.

Give inputs `aria-invalid` and `aria-describedby` pointing at the error element, as above. `GET /api/plugins/enquiries/forms/<form>` returns the public definition (labels, types, required, options, `turnstileSiteKey`) if you want to generate fields.

**Without JavaScript** the form posts normally and the server answers `303` back to `page` (or a same-origin Referer) with `?enquiry=sent` or `?enquiry=error&fields=name,email`. Read it in your page to show a message.

**From any client**: `POST /api/plugins/enquiries/submit/<form>` with `application/json` (Turnstile token as `turnstileToken`) or a form body (`cf-turnstile-response`). Same-origin only. Success: `{ ok: true, message }`. Errors: `400 { error, errors: [{ path, message }] }`.

## Security notes

- Submissions can only be created by the endpoint. `read`, `update` and `delete` are admin-only (`role === 'admin'`), `create` is denied for everyone through REST, RPC and the Local API. Admins can change only `status`.
- No IP addresses are stored. The IP is used for rate limiting (D1 counter) and Turnstile.
- Honeypot (`_hp`): a filled field gets a success response and nothing is stored.
- Strict validation against the code-defined form; no file uploads; body capped at 16 KiB.
- Cross-origin POSTs are refused by core (`Origin` must match).
- The redirect target for no-JS posts must be a same-origin relative path, otherwise `/`. No open redirects.
- Email: user values are HTML-escaped, subject and reply-to cannot inject headers. An email failure never fails the submission (`notified` stays `false`).
