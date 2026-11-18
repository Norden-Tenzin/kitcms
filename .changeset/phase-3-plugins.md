---
"@kitcms/core": minor
"@kitcms/plugin-seo": minor
"create-kitcms": minor
---

Phase 3 plugins and Phase 4 hardening:

- Plugin API: `defineConfig({ plugins: [...] })`. A plugin is `{ name, config(config) => config }`, applied when the config is sanitized.
- Composite indexes: `collection({ indexes: [{ fields, unique? }] })`. A composite UNIQUE violation is reported on its last column.
- `@kitcms/plugin-seo`: `seo()`, `getMeta()`, `<SeoHead>` and `<SerpPreview>` (from `@kitcms/plugin-seo/svelte`).
- `create-kitcms` pins the templates' `@kitcms/*` dependencies to the published versions when it is packed.
