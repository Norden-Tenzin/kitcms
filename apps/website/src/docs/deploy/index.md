---
title: Deploy & operate
description: Put a kitcms app on Cloudflare Workers.
order: 1
---

A kitcms app deploys with `wrangler deploy` like any SvelteKit app on the Cloudflare adapter. It needs the [Workers Paid plan](../getting-started/requirements.md).

## Create the resources

`pnpm create kitcms@latest` can create the D1 database and R2 bucket for you with `--create-resources` (it needs `wrangler login`). Otherwise create them with `wrangler` and put their names and IDs in `wrangler.jsonc`.

## Deploy

Apply the migrations to the production database, then deploy:

```sh
pnpm db:migrate:remote
pnpm run deploy
```

Set the `BETTER_AUTH_SECRET` secret on the Worker before the first sign-in.

## First admin

While the database has no users, `/admin/create-first-user` is open to anyone. Create your admin account right after the first deploy.
