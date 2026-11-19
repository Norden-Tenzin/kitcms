# __APP_NAME__

**Docs:** [kitcms.dev/docs/getting-started](https://kitcms.dev/docs/getting-started)

A [kitcms](https://kitcms.dev) app: SvelteKit + Cloudflare Workers + D1 + R2.

> **Requires the Workers Paid plan to deploy.** Password hashing exceeds the Free plan's CPU limit.

## Setup

```sh
pnpm install
cp .dev.vars.example .dev.vars   # then set BETTER_AUTH_SECRET (the scaffolder already did this)
pnpm db:generate init            # generate the first migration from src/kitcms.config.ts
pnpm db:migrate                  # apply it to the local D1
pnpm dev
```

Open <http://localhost:5173/admin>. The first visit asks you to create the first admin user.

## Schema and migrations

The schema is code: edit `src/kitcms.config.ts`, then `pnpm db:generate <name>` and `pnpm db:migrate`.

`src/kitcms.admin.ts` registers admin live previews (client-side, lazy). See `@kitcms/ui` "Live preview".

`pnpm types` regenerates the typed config declarations.

## Deploy

1. Create the resources if you have not (`wrangler d1 create __DB_NAME__`, `wrangler r2 bucket create __BUCKET_NAME__`) and put the D1 `database_id` into `wrangler.jsonc`.
2. `pnpm exec kitcms migrate --remote`
3. `pnpm exec wrangler secret put BETTER_AUTH_SECRET`
4. `pnpm run deploy`

`wrangler.jsonc` enables Smart Placement (the Worker runs near the D1 primary when that is faster). D1 read replication is optional and needs no code changes: turn it on in the Cloudflare dashboard (D1 → your database → Settings → Read replication). Visitors then read from the nearest replica, and signed-in editors still see their own saves. See the `@kitcms/core` README.

## Headless / RPC

`src/kitcms.rpc.ts` exports the `KitcmsRPC` entrypoint. Other Workers can bind to it with a Service Binding
(`"services": [{ "binding": "CMS", "service": "__APP_NAME__", "entrypoint": "KitcmsRPC" }]`) and read content over RPC.
