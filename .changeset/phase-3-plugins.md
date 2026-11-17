---
"@kitcms/core": minor
"@kitcms/ui": minor
"@kitcms/client": minor
"@kitcms/plugin-multi-tenant": minor
"@kitcms/plugin-seo": minor
"create-kitcms": minor
---

Phase 3 plugins and Phase 4 hardening:

- Plugin API: `defineConfig({ plugins: [...] })`. A plugin is `{ name, config(config) => config }`, applied when the config is sanitized.
- Composite indexes: `collection({ indexes: [{ fields, unique? }] })`. A composite UNIQUE violation is reported on its last column.
- Multi-tenancy, enforced in core (`config.tenancy`, set by `@kitcms/plugin-multi-tenant`):
  - **Scoping:** every access decision gets the request tenant's scope ANDed in, including `overrideAccess` calls that carry a tenant.
  - **Writes:** the tenant field is forced on writes, and references to another tenant's documents are rejected.
  - **Tenant sources:** the request's tenant comes from the host (`resolveTenant`), the admin's tenant switcher (`kitcms-tenant` cookie, re-validated on every request) or RPC `{ tenant }`.
  - **Cache and storage:** edge-cache keys include the tenant, and R2 upload keys get a per-tenant prefix.
- `@kitcms/plugin-multi-tenant`: `multiTenant()`, `tenantByHost()`. It adds the tenant fields and makes unique fields unique per tenant.
- `@kitcms/plugin-seo`: `seo()`, `getMeta()`, `<SeoHead>` and `<SerpPreview>` (from `@kitcms/plugin-seo/svelte`).
- `@kitcms/client`: a `tenant` option on calls, and a default tenant via `kitcms(binding, { tenant })`.
- Admin: a tenant switcher in the header. The tenant field is hidden while a tenant is selected, and lists show a tenant column under "All tenants".
- **Breaking (custom code only):** `KitcmsReq` now has a required `tenant: string | null`. Code that builds a `KitcmsReq` by hand must set it.
- `create-kitcms` pins the templates' `@kitcms/*` dependencies to the published versions when it is packed.
