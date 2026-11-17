---
"@kitcms/core": minor
"@kitcms/ui": minor
"@kitcms/client": minor
"create-kitcms": minor
---

Phase 2 website essentials:

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
