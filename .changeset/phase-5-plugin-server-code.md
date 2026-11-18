---
"@kitcms/core": minor
"@kitcms/plugin-seo": patch
---

Plugins can contribute server code, add-ons can be gated at runtime, and core can send email:

- `KitcmsPlugin` gains `handle` (runs for site requests, never `/admin` or `/api`), `endpoints` (served at `/api/plugins/<name>/<path>` with explicit `access`, same-origin checks for writes, a body size cap and an optional per-IP rate limit) and `admin.panels` (read-only admin panels). `config` is now optional. **Breaking (types):** code that calls `plugin.config(...)` directly needs `plugin.config?.(...)`.
- `entitlement: '<addon>'` on collections, globals and plugins, enforced through `config.entitlements` (set by `@kitcms/plugin-entitlements`): when an add-on is off, every operation is denied except trusted `overrideAccess` calls, the admin hides it, and its endpoints return 404. The edge-cache key includes the add-on state.
- `email: { from, replyTo? }` and `bindings.email` (default `EMAIL`): email through the Cloudflare Email Service `send_email` binding, logged instead of sent in `vite dev`. Plugin endpoints get it as `ctx.email`.
- Seeds can upload files: `ensureUpload(collection, { where, file, data })` puts a file (a path relative to the app, or bytes) into R2 and creates its document once, with the collection's type and size limits.
