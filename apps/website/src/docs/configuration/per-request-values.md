---
title: Per-request values
description: Make a few config values functions of the Worker env and the site's content, so one build can serve many deployments.
order: 10
---

This page covers config values that can be a function instead of a constant: which ones, what the function receives and when it runs.

Most config is the same for every deployment of your app. A few values are not. If you run one Worker per site from the same build (a platform for many customers, say), the email sender, the admin title and a contact address differ per site. They live in each Worker's variables or in the site's own content, and you cannot know them when you build.

Those options accept a **resolvable value**: a constant, or a function of the request's context.

```ts title="src/kitcms.config.ts"
import { defineConfig } from '@kitcms/core';

export default defineConfig({
	admin: {
		title: async ({ cms }) => String((await cms.findGlobal('site'))?.siteName ?? 'My site'),
	},
	email: {
		from: ({ env }) => ({ address: String(env.EMAIL_FROM), name: 'Website' }),
	},
	collections: [],
});
```

## What the function receives

```ts
(ctx: { env, cms }) => T | Promise<T>
```

| Property | What it is |
|---|---|
| `env` | The Worker's variables and secrets. |
| `cms` | The Local API acting as the system, for reading the site's content whoever is asking. |

`cms` is **read-only**. Reads ignore access rules, so a value can come from content that a visitor could not read themselves. Any write (`create`, `update`, `delete` and so on) throws. A value computed from content can never change it.

`cms` is not typed to your config here, so documents come back with unknown field values. Convert them (`String(...)`, a `typeof` check) before you return them.

The function runs on every use, not once at startup. If it is expensive, cache inside it.

## Which values accept one

| Option | Used for |
|---|---|
| `email.from`, `email.replyTo` | The sender of each message. See [Email](../auth/email.md). |
| `admin.title` | The admin header, the browser title and emails. See [Admin branding](./admin-branding.md). |
| enquiries `notify` (per form) | Who is emailed about a submission. See [Enquiries](../plugins/enquiries.md). |
| enquiries `turnstile.siteKey` | The Turnstile site key. |
| entitlements `manageUrl` | The "Manage plan" link. See [Entitlements](../plugins/entitlements.md). |

Plugin authors can use the same thing: `Resolvable<T>` and `resolveValue()` come from `@kitcms/core`, and endpoints and panels receive the context as `runtime`. See [Writing a plugin](../plugins/writing-a-plugin.md).

## When values are checked

- A **constant** is checked when the config loads, so a bad value is a startup error.
- A **function** is checked when it is used, because it has no value before that. What happens to a bad result depends on the option:

| Option | A bad or failed result |
|---|---|
| `email.from` | The message is not sent: `EmailNotConfiguredError`. The name is cleaned. |
| `email.replyTo` | Dropped. A typo in a site setting must not stop email. |
| `admin.title` | The admin shows `kitcms`. A thrown error is logged. |
| enquiries `notify` | Addresses that are not valid are skipped. With none left, the submission is stored without a notification. |
| enquiries `turnstile.siteKey` | An empty value means the form definition has no site key, so no widget is shown. Submissions still need a valid token, so the form cannot be submitted. |
| entitlements `manageUrl` | Core drops anything that is not an `https:` or `/`-relative link. |

## Why not read `env` yourself?

You can, in your own code. These options are read by kitcms itself, for the admin, for emails and for plugin endpoints, so a function is the only place to say where the value comes from.
