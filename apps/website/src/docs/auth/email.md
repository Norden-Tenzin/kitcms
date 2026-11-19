---
title: Email
description: Send email through Cloudflare Email Sending, covering the sender domain, the binding, the config, validation and development behaviour.
order: 2
---

This page shows how to set up outgoing email, from the Cloudflare sending domain to the config, and how plugin code sends a message.

kitcms sends email through the Workers `send_email` binding (Cloudflare Email Sending). It does this behind an internal adapter, like its database and storage access. kitcms itself uses it for [password resets and invites](./passwords-and-invites.md). [Enquiries](../plugins/enquiries.md) use it for notifications, and so can your own plugin endpoints.

## 1. Set up a sending domain

Cloudflare Email Sending is in open beta. Enable it for a domain on your account, then publish the DNS records it asks for:

```sh
pnpm exec wrangler email sending enable mail.example.com
pnpm exec wrangler email sending dns get mail.example.com
```

`dns get` prints the records to add to the domain's DNS. Once they resolve, the domain can send. Check it with `wrangler email sending settings mail.example.com`.

Use a subdomain such as `mail.example.com` rather than your main domain. Sending reputation is tracked per domain, so a subdomain keeps a mistake in your site's email from affecting your own staff's mail.

## 2. Add the binding

```jsonc title="wrangler.jsonc"
{
	"send_email": [
		{ "name": "EMAIL", "allowed_sender_addresses": ["noreply@mail.example.com"] }
	]
}
```

`allowed_sender_addresses` limits which `from` addresses the Worker may use. Set it, so a bug or a hostile value cannot send as another address on your domain. Keep the name `EMAIL`, or set `bindings.email` in the config.

## 3. Configure the sender

```ts title="src/kitcms.config.ts"
import { defineConfig } from '@kitcms/core';

export default defineConfig({
	email: {
		from: { address: 'noreply@mail.example.com', name: 'Acme' },
		replyTo: 'hello@example.com',
	},
	collections: [],
});
```

| Option | What it does |
|---|---|
| `email.from` | Required. `{ address, name? }`. The domain must be set up for Email Sending. |
| `email.replyTo` | Optional default reply-to address. |
| `bindings.email` | Name of the binding. Default `EMAIL`. |

A constant `from` is checked when the config loads: a bad address or name is a config error.

### Different sender per deployment

`from` and `replyTo` can be functions of the Worker's `env` and the site's own content. That suits one build serving several sites, where each has its own sender:

```ts title="src/kitcms.config.ts"
export default defineConfig({
	email: {
		from: async ({ env, cms }) => {
			const site = await cms.findGlobal('site');
			return { address: String(env.EMAIL_FROM), name: String(site?.siteName ?? 'Website') };
		},
		replyTo: ({ env }) => (typeof env.EMAIL_REPLY_TO === 'string' ? env.EMAIL_REPLY_TO : undefined),
	},
	collections: [],
});
```

A function is called for each message, so a sender is checked when it is used. A resolved `from` must be a valid address, or sending fails with `EmailNotConfiguredError`. Its name is cleaned (no line breaks, `<`, `>` or `"`, at most 100 characters), because it often comes from content. A resolved `replyTo` that is not an address is dropped, so a typo in a site setting does not stop email. See [Per-request values](../configuration/per-request-values.md).

## Without email

Without `email` in the config, or without the binding, email is off. Features that send email either hide their option (the **Forgot your password?** link, **Email an invite**) or skip it (enquiry notifications).

## In development

Under `vite dev`, kitcms logs each message to the console instead of sending it. You see the sender, recipients, subject and text, and any link in it. Nothing is sent, so you need neither the binding nor a domain to try a flow.

## Send from a plugin endpoint

Plugin endpoints get `ctx.email`:

```ts
const result = await ctx.email.send({
	to: 'team@example.com',
	subject: 'New enquiry',
	text: 'Someone sent a message.',
	html: '<p>Someone sent a message.</p>',
	replyTo: 'visitor@example.com',
});
```

| Field | Notes |
|---|---|
| `to` | One address or an array of up to 50. |
| `subject` | One line. No line breaks. |
| `text` | Required plain-text body. |
| `html` | Optional. |
| `replyTo` | Optional. Falls back to `email.replyTo`. |

`send` returns `{ messageId }`, or `{ messageId: null }` in development. kitcms checks every address and rejects line breaks in addresses and the subject, so a value from a form cannot inject headers. Bad input throws a `ValidationError` that names the field (`to` with more than 50 recipients, for example).

`ctx.email.enabled` tells you whether email is configured. When it is not, `send` throws `EmailNotConfiguredError`, whose message says what is missing: the `email` config or the binding. Check `enabled` first if the email is optional, as the Enquiries plugin does.

See [Writing a plugin](../plugins/writing-a-plugin.md).
