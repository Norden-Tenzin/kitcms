# @kitcms/core

Config, field definitions, the Local API, access rules, hooks, D1 storage, R2 uploads, Better Auth, the SvelteKit integration, the Service Binding RPC entrypoint and the `kitcms` CLI. You define collections in code; kitcms creates the D1 schema from that code and serves them through `locals.cms` and the admin UI.

```sh
pnpm add @kitcms/core @kitcms/ui
```

Pair it with `@sveltejs/kit` (v3), `@sveltejs/adapter-cloudflare`, `@sveltejs/vite-plugin-svelte`, `vite`, `wrangler` and `@cloudflare/vite-plugin`. `pnpm create kitcms@latest` sets all of this up.

## Usage

Define the config (`src/kitcms.config.ts`, from `templates/blank`):

```ts
import { collection, defineConfig, fields as f } from '@kitcms/core';

export default defineConfig({
	admin: { title: 'My site' },
	collections: [
		collection({
			slug: 'media',
			upload: { mimeTypes: ['image/*', 'application/pdf'] },
			access: { read: () => true },
			fields: { alt: f.text() },
		}),
		collection({
			slug: 'pages',
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'status', 'updatedAt'] },
			access: {
				// Published pages are public; signed-in users also see drafts.
				read: ({ req }) => (req.user ? true : { status: { equals: 'published' } }),
			},
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				status: f.select({
					options: ['draft', 'published'],
					defaultValue: 'draft',
					required: true,
					admin: { position: 'sidebar' },
				}),
				body: f.textarea(),
			},
		}),
	],
});
```

Fields: `text`, `textarea`, `email`, `slug`, `number`, `checkbox`, `select`, `date`, `richText`, `json`, `relationship`, `upload`, `group`, `array`, `blocks`, plus the layout-only `row`, `collapsible` and `tabs`.

Register the config type and wire the Worker (`src/app.d.ts`, `src/hooks.server.ts`):

```ts
// src/app.d.ts
import type config from './kitcms.config';

declare module '@kitcms/core' {
	interface Register {
		config: typeof config;
	}
}
```

```ts
// src/hooks.server.ts
import { kitcms } from '@kitcms/core/sveltekit';
import config from './kitcms.config';

export const handle = kitcms({ config }).handle;
```

After that, `locals.cms` is typed and runs every read as the request's user:

```ts
// src/routes/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { docs } = await locals.cms.find('pages', { sort: '-updatedAt', limit: 20 });
	return { pages: docs };
};
```

Build with the Vite plugin and the Cloudflare adapter (`vite.config.ts`):

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { kitcms, kitcmsAdapter } from '@kitcms/core/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ preprocess: vitePreprocess(), adapter: kitcmsAdapter() }), kitcms()],
});
```

The RPC entrypoint lives in `src/kitcms.rpc.ts`. It is only needed for headless consumers (see `@kitcms/client`):

```ts
import { createKitcmsRPC } from '@kitcms/core/rpc';
import config from './kitcms.config';

export class KitcmsRPC extends createKitcmsRPC(config) {}
```

## Drafts and versions

```ts
collection({ slug: 'pages', versions: { drafts: { autosave: true }, max: 20 }, fields: { /* ... */ } });
```

- The table holds the **published** state. Reads without `draft: true` only return published documents (also when populating relationships); `draft: true` needs a signed-in user or `overrideAccess`.
- `cms.update(..., { draft: true })` saves a draft version; `cms.update(...)` without it publishes the latest draft merged with `data`. `cms.unpublish(collection, id)` takes a document offline.
- `cms.findVersions`, `findVersionByID`, `restoreVersion` (and the `...Global...` variants) need read **and** update access to the document.
- `versions: true` keeps history only (no drafts, no `_status`).

## Admin branding

`admin.branding` white-labels the admin. Everything is optional and validated when the config loads:

```ts
admin: {
	title: 'My site',
	branding: {
		logo: 'https://cdn.example.com/logo.svg', // https://, a /-relative path, or a base64 data:image/ URL
		colors: { accent: '#0b7285', accentText: '#ffffff' }, // CSS colors: hex, rgb(), hsl(), oklch(), oklab() or a named color
	},
},
```

- `colors.accent` and `colors.accentText` are set as the `--kc-accent` and `--kc-accent-text` CSS variables on the admin root. Set both or neither. Hover and focus states follow the accent. Without them the default theme is used, including dark mode.
- `logo` is shown in the admin header (next to the title) and above the sign-in and first-user forms. The title is always shown as text.

## REST API

A JSON fallback for browsers and third parties that can't use a Service Binding. On Cloudflare, prefer Service Binding RPC (`@kitcms/client`) (no public surface, no auth round trip). It is served by the generated `src/routes/(kitcms)/api/[...path]/+server.ts` (`export { GET, POST, PATCH, DELETE } from '@kitcms/core/sveltekit/api'`; re-run the scaffold or add `PATCH, DELETE` to existing apps).

| Route | Action |
|---|---|
| `GET /api/collections/:slug` | `find` (paginated) |
| `POST /api/collections/:slug` | `create` (201). Not for `upload` or auth collections (405) |
| `GET / PATCH / DELETE /api/collections/:slug/:id` | `findByID` (404 when missing) / `update` / `delete` |
| `POST /api/collections/:slug/:id/move` | body `{ "before": id }` or `{ "after": id }` (orderable collections) |
| `POST /api/collections/:slug/:id/unpublish` | take a published doc offline (drafts) |
| `GET / PATCH /api/globals/:slug` | `findGlobal` / `updateGlobal` |

Read params: `where` (JSON object, same syntax as the Local API), `sort` (`-createdAt`), `limit`, `page`, `depth` (0-2), `pagination=false`, `draft=true` (signed-in only). Numbers must be plain integers, or the response is `400`. Write params: `depth`, `draft=true` (save as draft). Bodies must be `application/json` (415), at most 1 MiB (413) and a JSON object (400).

Auth: the caller is the session user (Better Auth cookie) or anonymous. It goes through the same access rules, hooks and validation as the Local API, and nothing in the request can bypass them. Anonymous writes reach the pipeline and are denied by the default rules. Every `POST`/`PATCH`/`DELETE` also needs a same-origin `Origin` header (CSRF), or the response is `403`.

Errors are `{ "error": string, "code": string, "errors"?: FieldError[], "references"?: [...] }` with the kitcms status (validation 400, forbidden 403, not found 404, still referenced 409). Unexpected failures return `500 { "error": "Internal error" }`. Responses send `cache-control: no-store`.

Turn it off with `defineConfig({ rest: false })`: every `/api/collections/*` and `/api/globals/*` route then returns 404 (admin, upload and media routes are unaffected).

## Edge cache (optional)

`defineConfig({ cache: { ttl: 60 } })` caches anonymous published reads of the Local API (`find`, `findOne`, `findByID`, `count`, `findGlobal`) in the Workers Cache API, per data centre. This covers public pages, anonymous RPC and anonymous REST. Signed-in users, drafts, `overrideAccess` and calls that pass `req` or `context` are never cached.

Every write (from any caller) replaces a generation token, so the data centre that handled the write serves fresh content immediately. Other data centres keep their entries until `ttl` seconds pass. Keys include a fingerprint of your schema, so a deploy with a changed schema never reads old entries.

The Cache API does nothing on `*.workers.dev`; use a custom domain. If the cache is unavailable, reads fall back to D1.

## CLI

The `kitcms` bin (from `@kitcms/core`) runs these commands. Each one reads the config from `src/kitcms.config.ts` or `kitcms.config.ts`, or from `--config <path>`:

```
Usage: kitcms <command> [options]

Commands:
  generate:schema          Write drizzle/schema.ts from the kitcms config
  generate:types [--out <path>]  Write kitcms-types.d.ts (document types for @kitcms/client)
  migrate:create <name>    Generate schema, then create a SQL migration in ./migrations
  migrate [--remote]       Apply migrations with wrangler (local D1 by default)
  migrate:status [--remote]  List migrations with wrangler
  info                     Show config, collections, bindings and migrations_dir check

Options:
  --config <path>          Path to the kitcms config (default: src/kitcms.config.ts or kitcms.config.ts)
  --out <path>             Output file for generate:types (default: kitcms-types.d.ts)
  --remote                 Target the remote D1 database (migrate, migrate:status)
  --help, -h               Show this help
```

## Notes

- Workers Paid is required. Password hashing (scrypt) uses more CPU than the free plan allows.
- Don't set `declaration` in the app's tsconfig. With large configs `declaration: true` fails with TS7056.
- The admin has no editor yet for `richText` (Phase 2). Such fields can be defined and stored, but the admin shows "No admin component" for them.

Status: pre-release (0.x), Cloudflare Workers + D1 + R2 only.
