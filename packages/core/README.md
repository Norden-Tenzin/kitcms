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
