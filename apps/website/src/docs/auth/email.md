---
title: Email
description: Configure the outgoing email sender that plugins use, through the Workers send_email binding.
order: 2
---

This page shows how to configure the email sender and how plugin code uses it.

kitcms sends email through the Workers `send_email` binding (Cloudflare Email Service). It does this behind an internal adapter, like its database and storage access. kitcms itself sends no email on its own. Plugins that need it, such as [Enquiries](../plugins/enquiries.md), use it, and so can your own plugin endpoints.

## Configure it

Set the sender in the config:

```ts title="src/kitcms.config.ts"
import { defineConfig } from '@kitcms/core';

export default defineConfig({
	email: {
		from: { address: 'no-reply@example.com', name: 'Acme' },
		replyTo: 'hello@example.com',
	},
	collections: [],
});
```

| Option | What it does |
|---|---|
| `email.from` | Required. `{ address, name? }`. The domain must be set up for Cloudflare Email Service. |
| `email.replyTo` | Optional default reply-to address. |
| `bindings.email` | Name of the binding. Default `EMAIL`. |

Add the binding to `wrangler.jsonc`:

```jsonc title="wrangler.jsonc"
{
	"send_email": [{ "name": "EMAIL" }]
}
```

Without `email` in the config, or without the binding, email is disabled. Features that send email then skip it or report that email is not configured.

## In development

Under `vite dev`, kitcms logs each message to the console instead of sending it. You see the sender, recipients, subject and text.

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

`send` returns `{ messageId }`. kitcms checks every address and rejects line breaks in addresses and the subject, so a value from a form cannot inject headers.

`ctx.email.enabled` tells you whether email is configured. When it is not, `send` throws `EmailNotConfiguredError`. Check `enabled` first if the email is optional, as the Enquiries plugin does.

See [Writing a plugin](../plugins/writing-a-plugin.md).
