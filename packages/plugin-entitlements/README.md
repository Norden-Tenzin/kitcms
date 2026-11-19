# @kitcms/plugin-entitlements

**Docs:** [kitcms.dev/docs/plugins/entitlements](https://kitcms.dev/docs/plugins/entitlements)

Turns a plan (set by your platform's control plane) into add-on gates and usage limits for a kitcms app.
The plan is read from a Worker variable, never from D1, and nothing in kitcms can edit it.

## Install

```ts
// kitcms.config.ts
import { entitlements } from '@kitcms/plugin-entitlements';

export default defineConfig({
	plugins: [
		entitlements({
			addons: { booking: { label: 'Booking', description: 'Table bookings' } },
			manageUrl: 'https://platform.example/plan',
		}),
	],
	// ...
});
```

```jsonc
// wrangler.jsonc (or set as a secret by the control plane)
{ "vars": { "KITCMS_ENTITLEMENTS": "{\"plan\":\"starter\",\"addons\":[\"booking\"],\"limits\":{\"documents\":{\"pages\":50},\"uploadBytes\":5000000}}" } }
```

## JSON shape

```json
{ "plan": "starter", "addons": ["booking"], "limits": { "documents": { "pages": 50 }, "uploadBytes": 5000000 } }
```

- `addons`: names matching `/^[a-z][a-z0-9_-]{0,63}$/`.
- `limits` is optional. Limits are non-negative integers.
- Options: `variable` (default `KITCMS_ENTITLEMENTS`), `read` (override how the value is read, for tests), `addons`, `manageUrl`.

## Gating features

Set `entitlement: '<addon>'` on a collection, global or plugin. When the add-on is off, core denies every operation
(except `overrideAccess`), hides it in the admin and 404s plugin endpoints.

```ts
collection({ slug: 'bookings', entitlement: 'booking', fields: { /* ... */ } });
```

## Limits

- `limits.documents[slug]`: creating a document is refused (403) once the collection holds that many.
- `limits.uploadBytes`: an upload collection refuses files larger than this.
- The auth collection is never limited.
- Limits are `beforeChange` hooks placed before your own. They apply to every create, including `overrideAccess` ones.
  A control-plane migration or seed can skip them with `{ context: { kitcmsEntitlementsBypass: true } }`.

## Fail closed

A missing variable, invalid JSON, one bad add-on name or a negative limit makes the whole value invalid: plan `unknown`,
no add-ons, no limits. Gated features turn off and ungated ones keep working. An error while reading counts as invalid.
The value is parsed once per isolate and re-parsed when it changes.

## Admin

The plugin adds a read-only "Plan & add-ons" panel (admins only): plan, add-ons (on or locked), document usage and a
"Manage plan" link. It adds no collections, globals or endpoints.
