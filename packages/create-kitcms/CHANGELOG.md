# create-kitcms

## 0.1.3

### Patch Changes

- b9039fa: The templates' `deploy` script now builds before `wrangler deploy`. Before, `pnpm run deploy` uploaded whatever was in `.svelte-kit/cloudflare` (or failed on a fresh checkout).
- e85389c: READMEs link to their pages on kitcms.dev/docs. `create-kitcms` ends with a link to the deploy guide and a reminder to create the admin account right after the first deploy.

## 0.1.2

No changes in this release.

## 0.1.1

### Patch Changes

- 9d754da: Validate the project name length (3-58 characters) before scaffolding. It doubles as the Worker, D1 and R2 bucket name, and R2 rejects names shorter than 3 characters, which broke `pnpm install` for short names like `t2`. Prompted names are asked again; names passed as an argument exit with an error.

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

- 3190c67: The `website` template is redesigned: mobile first, accessible mobile menu, a neutral re-brandable token system (theme colours in Site settings), and three selectable designs each for the header, footer, pages, blog list and posts, chosen in Site settings → Design and overridable per page.
