---
title: Read-only mode
description: Switch a deployment to read-only with one Worker variable, for a paused or over-quota site.
order: 7
---

This page shows how to make a deployment refuse every change while it keeps serving content, and what editors see.

Use it for a site that must stay up but must not change: a paused subscription, an over-quota account or a content freeze during a migration. Visitors see the same site. Editors can still sign in and look around.

## Turn it on

Set the `KITCMS_READ_ONLY` variable on the Worker to `1`, `true` or `yes`:

```jsonc title="wrangler.jsonc"
{
	"vars": { "KITCMS_READ_ONLY": "1" }
}
```

A hosting platform can set it without a rebuild, through the Cloudflare API or `wrangler deploy --var KITCMS_READ_ONLY:1`. Remove the variable, or set it to anything else, to switch writes back on.

Anything other than those values leaves the deployment writable, so a typo fails open. Check the admin after you set it.

## What stops

**Every write through the Local API throws `ReadOnlyError`** (status 403): `create`, `update`, `delete`, `move`, `unpublish`, `updateGlobal` and the version restores.

- It applies whoever asks, and `overrideAccess` does not get around it.
- Hooks get the same Local API, so they cannot write either.
- The admin, REST and RPC all go through the Local API, so they are refused in the same way. So are the [system setup endpoints](./system-setup.md) when they would write.
- **Uploads are refused before they reach R2**, so a rejected upload does not leave a file behind.

Catch it like any kitcms error:

```ts
import { ReadOnlyError } from '@kitcms/core';

try {
	await locals.cms.update('pages', id, { title: 'New' });
} catch (err) {
	if (err instanceof ReadOnlyError) return fail(403, { message: err.message });
	throw err;
}
```

The default message is "This website is paused, so changes are switched off."

## What keeps working

- **Reads**, on the site, through RPC and through REST.
- **Sign-in and sign-out.** Editors can still get into the admin to see their content.

## What editors see

The admin shows a notice, "This website is paused, so changes are switched off. You can still look around.", and offers no create, save or delete buttons. Fields are shown but cannot be edited.

## Test it locally

Add `KITCMS_READ_ONLY=1` to `.dev.vars`, restart `pnpm dev` and open `/admin`.
