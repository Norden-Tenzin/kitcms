# @kitcms/plugin-multi-tenant

Tenant isolation for kitcms: one Worker, one D1 database, many tenants (hotels, shops, sites). Each tenant only sees and changes its own documents through every entry point: the Local API, Service Binding RPC, REST, the admin and uploads.

The plugin only changes your config. **Enforcement lives in `@kitcms/core`**: the access engine ANDs a tenant scope into every decision *before* your own access rules run, so a permissive or missing rule can't widen it.

## Install

```bash
pnpm add @kitcms/plugin-multi-tenant
```

```ts
// src/kitcms.config.ts
import { collection, defineConfig, fields as f } from '@kitcms/core';
import { multiTenant, tenantByHost } from '@kitcms/plugin-multi-tenant';

export default defineConfig({
  plugins: [
    multiTenant({
      tenantsCollection: 'vendors',
      collections: ['pages', 'rooms', 'media'],
      // Public site: map the host to a tenant (custom domain, or {slug}.example.com).
      resolveTenant: tenantByHost({
        collection: 'vendors',
        domainField: 'customDomain',
        subdomain: { field: 'slug', rootDomain: 'example.com' },
      }),
    }),
  ],
  collections: [
    collection({
      slug: 'vendors',
      access: { read: () => true },
      fields: { name: f.text({ required: true }), slug: f.text({ unique: true }), customDomain: f.text() },
    }),
    // pages, rooms, media ...
  ],
});
```

Then generate and apply a migration (`kitcms migrate:create tenancy && kitcms migrate`).

## What it adds

- A required, indexed `tenant` relationship on every scoped collection (shown in the admin sidebar, set automatically).
- A `tenants` hasMany relationship on the users (auth) collection. **Only "all" users (default: role `admin`) can change it**, so users can't add themselves to tenants.
- `unique` fields on scoped collections become unique **per tenant**: a `(tenant, slug)` index replaces the global one, so two hotels can both have a `home` page.
- R2 upload keys under `tenants/<id>/` (change with `storagePrefix`, or `false` for none).

## How the request tenant is chosen

| Request | Tenant |
|---|---|
| Public site, login page, anonymous REST | `resolveTenant({ event, cms })`, cached per host for `cacheTtl` seconds (default 60) |
| Signed-in admin / REST | The tenant picked in the admin's tenant switcher (cookie `kitcms-tenant`, re-checked on every request), else the host's tenant if the user belongs to it, else the user's first tenant. "All" users with nothing picked act on **every** tenant |
| Service Binding RPC | The caller's `{ tenant }` option (`kitcms(env.CMS, { tenant })` sets a default) |
| Local API in your code | `locals.cms` already acts on the request's tenant |

## Rules

| | With a tenant | Without a tenant |
|---|---|---|
| Scoped collections | Only that tenant's documents, **including** `overrideAccess` / RPC `as: 'system'` calls that carry a tenant. A signed-in user must belong to it | Denied, except for trusted code (`overrideAccess`, `kitcms seed`, system RPC without `tenant`) and "all" users, which see every tenant |
| Tenants collection | Signed-in tenant users read/update only their own tenants and can't create or delete any. Anonymous callers follow the collection's own rule | same |
| Users collection | Tenant users see themselves and the users of the current tenant, and update only themselves | Themselves only |

- **Writes:** the tenant field is forced to the request's tenant before validation and again after your `beforeChange` hooks. A document can't be created in, or moved to, another tenant.
- **References:** a relationship or upload (at the top level, in groups, arrays or blocks) to a document of a scoped collection must point into the same tenant. Otherwise the write fails with `Not found`, the same error as for a missing id.
- **Edge cache:** keys include the tenant.
- **Globals** are never tenant-scoped. Keep per-tenant settings on the tenant document.

## Options

| Option | Default | |
|---|---|---|
| `tenantsCollection` | (required) | Collection whose documents are the tenants |
| `collections` | (required) | Scoped collection slugs |
| `field` | `'tenant'` | Tenant field name |
| `userField` | `'tenants'` | Users' tenants field |
| `resolveTenant` | none | Host → tenant id for requests without a signed-in user. Without it, the public site can't read scoped collections |
| `userTenants` | admins `'all'`, others `user.tenants` | Tenants a user may act on |
| `storagePrefix` | `t => \`tenants/${t}/\`` | R2 key prefix, `[A-Za-z0-9/_-]` ending in `/` |
| `cacheTtl` | `60` | Seconds to cache `resolveTenant` per host (`0` = off) |

## Seeding

`kitcms seed` runs as trusted code with no tenant, so pass the tenant explicitly:

```ts
const a = await ensure('vendors', { where: { slug: { equals: 'a' } }, data: { name: 'Hotel A', slug: 'a' } });
await ensure('rooms', { where: { slug: { equals: 'deluxe' }, tenant: { equals: a.id } }, data: { name: 'Deluxe', tenant: a.id } });
```

## Limits

- Plugin-added fields (`tenant`, `tenants`) are not in your app's inferred `DocOf` types. Headless consumers get them from `kitcms generate:types`.
- `/api/media/*` uses the admin-selected tenant for signed-in editors. Serve sites from `media.publicUrl` (an R2 custom domain).
- A changed tenant domain or slug can take up to `cacheTtl` seconds to apply in each isolate.
