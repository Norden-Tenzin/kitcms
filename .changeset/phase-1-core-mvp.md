---
"@kitcms/core": minor
"@kitcms/ui": minor
"@kitcms/client": minor
"create-kitcms": minor
---

Phase 1 core MVP:

- Config and field definitions (`defineConfig`, `collection`, `fields`) with type inference for `locals.cms` and the client.
- D1 pipeline for the Local API: access, hooks, validation and D1, with `where`, `depth` and `_refs` delete protection.
- Better Auth admin sign-in, the first-user screen, and R2 uploads with a media library.
- Admin UI with components for every v1 field type except rich text (its Tiptap editor comes next).
- Service Binding RPC (`KitcmsRPC`), the typed `@kitcms/client`, `kitcms generate:types`, the migrations CLI, and `create-kitcms` with the `blank` template.
