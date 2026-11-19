# @kitcms/ui

## 0.1.1

### Patch Changes

- Updated dependencies [8dc2324]
  - @kitcms/core@0.1.1

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

- dc5c1a8: The admin works on phones and tablets: a menu drawer below 800px, 44px touch targets, scrolling tabs and tables, a full-screen media picker, touch-friendly row reordering and a collapsible live preview. Plugin admin panels (read-only) are rendered and listed in the navigation.

### Patch Changes

- Updated dependencies [db7d444]
- Updated dependencies [fbda014]
- Updated dependencies [ca0ac7a]
- Updated dependencies [6a989aa]
- Updated dependencies [7fd9d05]
  - @kitcms/core@0.1.0
