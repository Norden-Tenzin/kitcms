# @kitcms/plugin-seo

## 0.1.3

### Patch Changes

- e85389c: READMEs link to their pages on kitcms.dev/docs. `create-kitcms` ends with a link to the deploy guide and a reminder to create the admin account right after the first deploy.
- Updated dependencies [e85389c]
  - @kitcms/core@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [73cdd61]
- Updated dependencies [73cdd61]
- Updated dependencies [73cdd61]
- Updated dependencies [73cdd61]
- Updated dependencies [73cdd61]
- Updated dependencies [73cdd61]
  - @kitcms/core@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [8dc2324]
  - @kitcms/core@0.1.1

## 0.1.0

### Minor Changes

- ca0ac7a: Phase 3 plugins and Phase 4 hardening:

  - Plugin API: `defineConfig({ plugins: [...] })`. A plugin is `{ name, config(config) => config }`, applied when the config is sanitized.
  - Composite indexes: `collection({ indexes: [{ fields, unique? }] })`. A composite UNIQUE violation is reported on its last column.
  - `@kitcms/plugin-seo`: `seo()`, `getMeta()`, `<SeoHead>` and `<SerpPreview>` (from `@kitcms/plugin-seo/svelte`).
  - `create-kitcms` pins the templates' `@kitcms/*` dependencies to the published versions when it is packed.

- 19edeb1: `seo()` gains `redirects` (an editor-managed `redirects` collection applied before the site renders, with loop and unsafe-target checks), `sitemap` (`/sitemap.xml` from published documents, skipping `noIndex`) and `robots` (`/robots.txt`). Turning on `redirects` adds a table: run `kitcms migrate:create`.

### Patch Changes

- 7fd9d05: Plugins can contribute server code, add-ons can be gated at runtime, and core can send email:

  - `KitcmsPlugin` gains `handle` (runs for site requests, never `/admin` or `/api`), `endpoints` (served at `/api/plugins/<name>/<path>` with explicit `access`, same-origin checks for writes, a body size cap and an optional per-IP rate limit) and `admin.panels` (read-only admin panels). `config` is now optional. **Breaking (types):** code that calls `plugin.config(...)` directly needs `plugin.config?.(...)`.
  - `entitlement: '<addon>'` on collections, globals and plugins, enforced through `config.entitlements` (set by `@kitcms/plugin-entitlements`): when an add-on is off, every operation is denied except trusted `overrideAccess` calls, the admin hides it, and its endpoints return 404. The edge-cache key includes the add-on state.
  - `email: { from, replyTo? }` and `bindings.email` (default `EMAIL`): email through the Cloudflare Email Service `send_email` binding, logged instead of sent in `vite dev`. Plugin endpoints get it as `ctx.email`.
  - Seeds can upload files: `ensureUpload(collection, { where, file, data })` puts a file (a path relative to the app, or bytes) into R2 and creates its document once, with the collection's type and size limits.

- Updated dependencies [db7d444]
- Updated dependencies [fbda014]
- Updated dependencies [ca0ac7a]
- Updated dependencies [6a989aa]
- Updated dependencies [7fd9d05]
  - @kitcms/core@0.1.0
