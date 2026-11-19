---
title: Entitlements plugin
description: Gate collections, globals and plugins behind add-ons and enforce usage limits with @kitcms/plugin-entitlements.
order: 4
---

This page covers `@kitcms/plugin-entitlements`, which reads a plan from your platform and turns it into add-on gates and limits. It is for hosting many kitcms sites, where something outside the site decides what each one may use.

```sh
pnpm add @kitcms/plugin-entitlements
```

The plan is read from a Worker variable, never from D1, and nothing in kitcms can edit it. That is the point: an editor with admin rights cannot give themselves an add-on.

## Set it up

```ts title="src/kitcms.config.ts"
import { defineConfig } from '@kitcms/core';
import { entitlements } from '@kitcms/plugin-entitlements';

export default defineConfig({
	plugins: [
		entitlements({
			addons: { booking: { label: 'Booking', description: 'Table bookings' } },
			manageUrl: 'https://platform.example/plan',
		}),
	],
	collections: [/* ... */],
});
```

Set the plan in the `KITCMS_ENTITLEMENTS` variable, in `wrangler.jsonc` or as a secret set by your control plane:

```jsonc title="wrangler.jsonc"
{
	"vars": {
		"KITCMS_ENTITLEMENTS": "{\"plan\":\"starter\",\"addons\":[\"booking\"],\"limits\":{\"documents\":{\"pages\":50},\"uploadBytes\":5000000}}"
	}
}
```

| Option | What it does |
|---|---|
| `addons` | Known add-ons, so the panel can show locked ones too: `{ name: { label, description? } }`. |
| `manageUrl` | Where the "Manage plan" link points. A string, or a function of the Worker `env` and the site's content, so each site can link to its own plan page. Core drops anything that is not an `https:` or `/`-relative link. See [Per-request values](../configuration/per-request-values.md). |
| `variable` | Name of the variable. Default `KITCMS_ENTITLEMENTS`. |
| `read` | Overrides how the value is read. For tests. |

The value is JSON: `{ "plan": "starter", "addons": ["booking"], "limits": { "documents": { "pages": 50 }, "uploadBytes": 5000000 } }`. Add-on names match `/^[a-z][a-z0-9_-]{0,63}$/`. `limits` is optional, and limits are non-negative integers.

## Gate features

Set `entitlement` on a collection, global or plugin:

```ts
collection({ slug: 'bookings', entitlement: 'booking', fields: { /* ... */ } });
```

While the add-on is off, core denies every operation on it, even for admins. Only `overrideAccess` still works. The admin hides it (and its URL returns 404), a plugin's endpoints return 404, and its `handle` and panels are skipped. A gated item with no provider configured is a config error.

## Limits

- `limits.documents[slug]`: creating a document is refused (403) once the collection holds that many.
- `limits.uploadBytes`: an upload collection refuses files larger than this.
- The auth collection is never limited.

Limits are `beforeChange` hooks that run before your own. They apply to every create, including `overrideAccess` ones. A migration or seed run by your control plane can skip them with `{ context: { kitcmsEntitlementsBypass: true } }`.

## Fail closed

A missing variable, invalid JSON, one bad add-on name or a negative limit makes the whole value invalid: plan `unknown`, no add-ons and no limits. Gated features turn off and ungated ones keep working. An error while reading counts as invalid. The value is parsed once per isolate and parsed again when it changes.

## Admin

The plugin adds a read-only "Plan and add-ons" panel for admins: plan, add-ons (on or locked), document usage and a "Manage plan" link. It adds no collections, globals or endpoints.
