---
title: CLI
description: Every kitcms command and option, with what it reads and writes.
order: 2
---

This page documents the `kitcms` command, which `@kitcms/core` installs as a bin. It runs in Node, as build tooling. Nothing in it runs on Workers.

Run it with `pnpm exec kitcms <command>`. The scaffolded `package.json` has shortcuts: `pnpm db:generate`, `pnpm db:migrate` and `pnpm types`.

```text
Usage: kitcms <command> [options]

Commands:
  generate:schema          Write drizzle/schema.ts from the kitcms config
  generate:types [--out <path>]  Write kitcms-types.d.ts (document types for @kitcms/client)
  migrate:create <name>    Generate schema, then create a SQL migration in ./migrations
  migrate [--remote]       Apply migrations with wrangler (local D1 by default)
  migrate:status [--remote]  List migrations with wrangler
  seed [--remote] [--seed <path>]  Run src/kitcms.seed.ts (idempotent) against local or remote D1/R2
  info                     Show config, collections, bindings and migrations_dir check

Options:
  --config <path>          Path to the kitcms config (default: src/kitcms.config.ts or kitcms.config.ts)
  --out <path>             Output file for generate:types (default: kitcms-types.d.ts)
  --seed <path>            Seed file for the seed command (default: src/kitcms.seed.ts)
  --remote                 Target the remote D1 database (migrate, migrate:status, seed)
  --help, -h               Show this help
```

Every command reads the config from `src/kitcms.config.ts` or `kitcms.config.ts`, unless you pass `--config`. The `--help` flag prints the text above for every command. Commands exit with `0` on success and `1` on an error, and print the error to stderr. An unknown command or option prints the usage and exits with `1`.

## Commands

### `generate:schema`

Writes `drizzle/schema.ts`, a Drizzle schema for your collections, globals and kitcms's own tables. It only rewrites the file when the content changed. You rarely run it yourself, because `migrate:create` does.

### `generate:types`

Writes document types for [`@kitcms/client`](../content/rpc.md) consumers. Default output `kitcms-types.d.ts` in the app root. Use `--out <path>` to write elsewhere, such as into the consumer project. See [Generated types](../content/types.md).

### `migrate:create <name>`

Generates the schema, then runs drizzle-kit to create a SQL migration named `<name>` in `migrations/`. The name is required.

```sh
pnpm exec kitcms migrate:create add-subtitle
```

If the config has no schema changes, it prints `No schema changes, nothing to migrate.` and creates nothing. It reminds you to review the SQL: a column or table rename appears as a drop and an add, and would lose data.

### `migrate`

Applies pending migrations with `wrangler d1 migrations apply` for the D1 binding named in your config. Without `--remote` it targets the local D1 (`--local`).

```sh
pnpm exec kitcms migrate            # local D1
pnpm exec kitcms migrate --remote   # production D1
```

It finds wrangler in your app's `node_modules`, or falls back to `npx wrangler`. Wrangler's output is passed through, and a non-zero exit is an error.

### `migrate:status`

Lists migrations with `wrangler d1 migrations list`. Add `--remote` for the production database.

### `seed`

Runs your seed file against D1 and R2. The default file is `src/kitcms.seed.ts` (or `kitcms.seed.ts`). Use `--seed <path>` for another file.

```ts title="src/kitcms.seed.ts"
import { defineSeed } from '@kitcms/core';

export default defineSeed(async ({ cms, ensure, ensureGlobal, ensureUpload, log }) => {
	await ensure('pages', { where: { slug: { equals: 'home' } }, data: { title: 'Home', slug: 'home' } });
	await ensureGlobal('site', { siteName: 'Acme' });
	log('done');
});
```

- Every call runs with `overrideAccess: true`, so locked collections and access rules do not get in the way.
- `ensure(collection, { where, data })` creates `data` only when nothing matches `where`. `ensureGlobal(slug, data)` writes only a global that was never saved. `ensureUpload(collection, { where, file, data? })` uploads a file once, where `file` is a path relative to the app root or the bytes. The collection's `mimeTypes` and `maxFileSize` apply.
- Running the seed again never overwrites what editors changed.

Without `--remote`, it uses the local D1 and R2 state. With `--remote`, it seeds your real database. That needs `"remote": true` on the D1 entry in `wrangler.jsonc`, or the command stops with an explanation. `seed` needs `wrangler` installed in your app.

### `info`

Prints the kitcms version, the config path, each collection with its field count (the auth collection is marked), the binding names and a check of your wrangler config, including whether `migrations_dir` is `migrations`.

## Options

| Option | Used by | What it does |
|---|---|---|
| `--config <path>` | All | The config file. Default `src/kitcms.config.ts`, then `kitcms.config.ts`. |
| `--out <path>` | `generate:types` | Output file. Default `kitcms-types.d.ts`. |
| `--seed <path>` | `seed` | The seed file. Default `src/kitcms.seed.ts`. |
| `--remote` | `migrate`, `migrate:status`, `seed` | Target the remote D1 database. |
| `--help`, `-h` | All | Print the usage. |

`--out`, `--seed` and `--config` also accept the `--flag=value` form.

## How the CLI loads your config

The CLI loads `kitcms.config.ts` through Vite's module runner, with the Svelte plugin, so your config can import `.svelte` files, use aliases such as `#lib` and use the same imports as your app. That is why the config must not import anything that needs the Workers runtime at load time.
