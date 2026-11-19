---
title: Project tour
description: The files in a scaffolded kitcms app and which ones are yours to edit.
order: 4
---

This page walks through the files of a scaffolded app, so you know which ones are yours to edit.

## The blank template

```text
my-site/
  src/
    kitcms.config.ts        your schema
    kitcms.admin.ts         live preview components
    kitcms.rpc.ts           the Service Binding entrypoint
    hooks.server.ts         installs kitcms
    app.d.ts                registers the config type
    routes/
      +page.server.ts       reads content with locals.cms
      (kitcms)/admin/       generated admin route
      (kitcms)/api/         generated API route
  migrations/               SQL migrations (created by kitcms)
  drizzle/schema.ts         generated Drizzle schema (created by kitcms)
  wrangler.jsonc            Worker, D1 and R2 bindings
  vite.config.ts            SvelteKit plus the kitcms Vite plugin
  .dev.vars                 local secrets (not committed)
```

### Files you edit

- **`src/kitcms.config.ts`** is the only place the schema exists. See [Configuration](../configuration/index.md).
- **`src/kitcms.admin.ts`** registers live preview components. They run in the browser, which is why they are not in the config. See [Live preview](../configuration/live-preview.md).
- **`src/routes/`** is your site. Load content with `locals.cms` in `+page.server.ts` files.
- **`wrangler.jsonc`** holds the bindings. Keep the binding names `DB` and `BUCKET`, or set `bindings` in the config to match your names.

### Files kitcms generates

Do not edit these. They start with a `GENERATED` comment.

- **`src/routes/(kitcms)/admin/[...path]/`** renders the admin from `@kitcms/ui` and re-exports `load` and `actions` from `@kitcms/core/sveltekit/admin`.
- **`src/routes/(kitcms)/api/[...path]/+server.ts`** re-exports `GET`, `POST`, `PATCH` and `DELETE` from `@kitcms/core/sveltekit/api`. It serves the REST API, uploads, media and plugin endpoints.
- **`src/kitcms.rpc.ts`** exports the `KitcmsRPC` class that other Workers bind to. It must stay a class declaration, because wrangler finds entrypoints by exported classes.
- **`drizzle/schema.ts`** and **`migrations/`** come from `kitcms migrate:create`.

### The wiring

`src/hooks.server.ts` installs kitcms. It sets `locals.cms` for every request:

```ts title="src/hooks.server.ts"
import { kitcms } from '@kitcms/core/sveltekit';
import config from './kitcms.config';

export const handle = kitcms({ config }).handle;
```

`src/app.d.ts` registers the config type, which is what types `locals.cms`:

```ts title="src/app.d.ts"
import type config from './kitcms.config';

declare module '@kitcms/core' {
	interface Register {
		config: typeof config;
	}
}
```

`vite.config.ts` adds the kitcms Vite plugin and wraps the Cloudflare adapter, so the same Worker also exports `KitcmsRPC`:

```ts title="vite.config.ts"
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { kitcms, kitcmsAdapter } from '@kitcms/core/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ preprocess: vitePreprocess(), adapter: kitcmsAdapter() }), kitcms()],
});
```

SvelteKit 3 keeps its config in `vite.config.ts`. There is no `svelte.config.js`.

## Scripts

| Script | Runs |
|---|---|
| `pnpm dev` | The dev server with local D1 and R2. |
| `pnpm preview` | `pnpm build && wrangler dev`: the built Worker under workerd, like production. |
| `pnpm db:generate <name>` | `kitcms migrate:create <name>` |
| `pnpm db:migrate` | `kitcms migrate` on the local D1. Add `--remote` for production. |
| `pnpm types` | `kitcms generate:types` |
| `pnpm run deploy` | `wrangler deploy` |
| `pnpm check` | `svelte-check` |

## The website template

The `website` template adds a public site on top of the same structure.

- `src/routes/(site)/` has the public routes: pages, a paginated blog and legal pages.
- `src/lib/blocks/` has one Svelte component per block, plus `RenderBlocks.svelte`, which maps each block's `blockType` to its component.
- `src/lib/image.ts` and `src/lib/Img.svelte` build image URLs. See [Images](../media/images.md).
- `src/kitcms.seed.ts` holds example content. Run it with `pnpm db:seed`.
- It also adds the `db:migrate:remote` and `db:seed:remote` scripts.

## Next

[Add your first collection](./first-collection.md).
