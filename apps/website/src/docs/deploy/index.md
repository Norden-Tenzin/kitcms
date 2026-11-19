---
title: Deploy & operate
description: Create the Cloudflare resources, migrate, set secrets, deploy and create the first admin.
order: 1
---

This page walks through a first deploy of a kitcms app to Cloudflare Workers and the things to check afterwards.

A kitcms app deploys with `wrangler deploy`, like any SvelteKit app on the Cloudflare adapter. It needs the [Workers Paid plan](../getting-started/requirements.md) and `wrangler login`.

## 1. Create the D1 database and R2 bucket

`pnpm create kitcms@latest --create-resources` can do this for you. Otherwise create them with wrangler:

```sh
pnpm exec wrangler d1 create my-site
pnpm exec wrangler r2 bucket create my-site
```

`wrangler d1 create` prints a `database_id`. Put it in `wrangler.jsonc`, together with the names:

```jsonc title="wrangler.jsonc"
{
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "my-site",
			"database_id": "00000000-0000-0000-0000-000000000000",
			"migrations_dir": "migrations"
		}
	],
	"r2_buckets": [{ "binding": "BUCKET", "bucket_name": "my-site" }]
}
```

- Keep the binding names `DB` and `BUCKET`, or set `bindings` in `kitcms.config.ts` to your names.
- Keep `migrations_dir` as `migrations`. That is where `kitcms migrate:create` writes. `pnpm exec kitcms info` warns if it differs.

You can commit `database_id`: it is an identifier, not a secret. Do not commit an `account_id`. Wrangler reads your account from `wrangler login` or the `CLOUDFLARE_ACCOUNT_ID` variable.

## 2. Apply the migrations

Migrations are plain SQL files. Apply them to the production database:

```sh
pnpm exec kitcms migrate --remote
```

`--remote` runs `wrangler d1 migrations apply` against your real database. Without it, kitcms targets the local D1. The scaffolded `package.json` has a `db:migrate` script (`kitcms migrate`), so `pnpm db:migrate --remote` works too. Check what has been applied with `kitcms migrate:status --remote`.

## 3. Set secrets

```sh
pnpm exec wrangler secret put BETTER_AUTH_SECRET
```

Wrangler asks for the value. Use a random string of at least 32 characters, for example the output of `openssl rand -base64 32`. It signs sessions, and the Worker throws on sign-in without it. Keep it secret, and keep it the same across deploys: changing it signs everyone out.

Locally, the secret lives in `.dev.vars`, which the scaffolder creates and `.gitignore` excludes.

Optionally set `BETTER_AUTH_URL` to your public origin, for example `https://example.com`. See [Auth and users](../auth/index.md).

## 4. Build and deploy

```sh
pnpm run deploy
```

The `deploy` script runs `pnpm build`, then `wrangler deploy` (`wrangler.jsonc` points `main` at the build output). Wrangler prints the `workers.dev` URL.

## 5. Seed content (optional)

If you have a seed file, such as the `website` template's `src/kitcms.seed.ts`, run it against the production database:

```sh
pnpm exec kitcms seed --remote
```

The seed is idempotent: it creates only what is missing and never overwrites edits. To reach the real database and bucket, the D1 entry in `wrangler.jsonc` needs `"remote": true`. Add it temporarily, then remove it, or the seed refuses to run:

```jsonc
{ "binding": "DB", "database_name": "my-site", "database_id": "...", "migrations_dir": "migrations", "remote": true }
```

The seed runs with `overrideAccess`, so it can create documents in locked collections. See [Orderable and locked](../configuration/orderable-and-locked.md).

## 6. Create the first admin

Create your admin account right after the first deploy. Until a user exists, `/admin/create-first-user` is open to anyone.

Open `/admin` on your deployed URL and fill in the form. Once one user exists, that page redirects to sign-in and creates nothing. See [Auth and users](../auth/index.md).

Do this before you attach a custom domain or share the URL.

## After the first deploy

| Topic | Page |
|---|---|
| Serve the site on your own domain | [Custom domains](./custom-domains.md) |
| Cache anonymous reads at the edge | [Edge cache](./edge-cache.md) |
| Faster reads far from your database | [Read replication and Smart Placement](./replication-and-placement.md) |
| Move to a newer kitcms | [Upgrading](./upgrading.md) |
| Provision a site from a script (hosting platforms) | [System setup](./system-setup.md) |
| Pause a site's writes | [Read-only mode](./read-only-mode.md) |

## Deploying changes

For each release of your app:

1. If the schema changed: `pnpm db:generate <name>`, review the SQL and commit it.
2. `pnpm exec kitcms migrate --remote`
3. `pnpm run deploy`

Migrate first. The old code keeps working against the added columns for the short time before the new code goes live. For breaking schema changes such as a renamed field, plan a two-step change: add the new field and deploy, copy the data, then drop the old one.
