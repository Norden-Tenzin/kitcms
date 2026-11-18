# @kitcms/core

## 0.1.0

### Minor Changes

- db7d444: Phase 1 core MVP:

  - Config and field definitions (`defineConfig`, `collection`, `fields`) with type inference for `locals.cms` and the client.
  - D1 pipeline for the Local API: access, hooks, validation and D1, with `where`, `depth` and `_refs` delete protection.
  - Better Auth admin sign-in, the first-user screen, and R2 uploads with a media library.
  - Admin UI with components for every v1 field type except rich text (its Tiptap editor comes next).
  - Service Binding RPC (`KitcmsRPC`), the typed `@kitcms/client`, `kitcms generate:types`, the migrations CLI, and `create-kitcms` with the `blank` template.

- fbda014: Phase 2 website essentials:

  - Globals (`global()`, `cms.findGlobal` / `updateGlobal`, admin `/admin/globals/:slug`).
  - Orderable collections (`orderable: true`, drag-to-sort, `cms.move`) and locked collections (`admin.locked`), plus `kitcms seed` with `defineSeed`.
  - Drafts, publish, autosave, version history and restore (`versions`), with drafts hidden from public reads.
  - Inline live preview registered in `src/kitcms.admin.ts` (`defineAdmin`, `useRelation`). **Breaking:** `block({ admin: { preview } })` is removed; register previews in `kitcms.admin.ts`.
  - Rich text field (Tiptap, admin only) and `@kitcms/core/richtext` (`toHTML`, `toPlainText`).
  - Admin branding (`admin.branding`: logo, accent colors).
  - REST fallback API at `/api/collections/*` and `/api/globals/*` (`rest: false` turns it off). **Breaking:** the app's api route must re-export `GET, POST, PATCH, DELETE`.
  - RPC writes (`create`, `update`, `delete`, `move`, `unpublish`, `updateGlobal`) for `as: 'system'` callers only; `findGlobal`; draft reads system-only. The client is typed for all of them.
  - Opt-in edge cache for anonymous published reads (`cache: { ttl }`), D1 read replication through the Sessions API, and Smart Placement in the templates.
  - `create-kitcms --template website`.

- ca0ac7a: Phase 3 plugins and Phase 4 hardening:

  - Plugin API: `defineConfig({ plugins: [...] })`. A plugin is `{ name, config(config) => config }`, applied when the config is sanitized.
  - Composite indexes: `collection({ indexes: [{ fields, unique? }] })`. A composite UNIQUE violation is reported on its last column.
  - `@kitcms/plugin-seo`: `seo()`, `getMeta()`, `<SeoHead>` and `<SerpPreview>` (from `@kitcms/plugin-seo/svelte`).
  - `create-kitcms` pins the templates' `@kitcms/*` dependencies to the published versions when it is packed.

- 6a989aa: New `@kitcms/plugin-entitlements`: runtime add-on gating from a Worker var (`KITCMS_ENTITLEMENTS`, never stored in D1), with document and upload limits and a read-only "Plan & add-ons" admin panel. Missing or invalid values turn gated features off. `@kitcms/core` now exports its error classes (`ForbiddenError`, `ValidationError`, `isKitcmsError`, ...) for plugins.
- 7fd9d05: Plugins can contribute server code, add-ons can be gated at runtime, and core can send email:

  - `KitcmsPlugin` gains `handle` (runs for site requests, never `/admin` or `/api`), `endpoints` (served at `/api/plugins/<name>/<path>` with explicit `access`, same-origin checks for writes, a body size cap and an optional per-IP rate limit) and `admin.panels` (read-only admin panels). `config` is now optional. **Breaking (types):** code that calls `plugin.config(...)` directly needs `plugin.config?.(...)`.
  - `entitlement: '<addon>'` on collections, globals and plugins, enforced through `config.entitlements` (set by `@kitcms/plugin-entitlements`): when an add-on is off, every operation is denied except trusted `overrideAccess` calls, the admin hides it, and its endpoints return 404. The edge-cache key includes the add-on state.
  - `email: { from, replyTo? }` and `bindings.email` (default `EMAIL`): email through the Cloudflare Email Service `send_email` binding, logged instead of sent in `vite dev`. Plugin endpoints get it as `ctx.email`.
  - Seeds can upload files: `ensureUpload(collection, { where, file, data })` puts a file (a path relative to the app, or bytes) into R2 and creates its document once, with the collection's type and size limits.
