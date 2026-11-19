---
title: Deploy in 5 minutes
description: The shortest path from a local project to a live Worker.
order: 6
---

This page lists the commands that put a new project on Cloudflare. [Deploy and operate](../deploy/index.md) explains each step.

You need the [Workers Paid plan](./requirements.md) and `wrangler login`.

## Steps

1. Create the resources, if the scaffolder did not (`--create-resources`). Put the database ID into `wrangler.jsonc`.

   ```sh
   pnpm exec wrangler d1 create my-site
   pnpm exec wrangler r2 bucket create my-site
   ```

2. Apply the migrations to the production database:

   ```sh
   pnpm db:migrate --remote
   ```

3. Set the secret that signs sessions:

   ```sh
   pnpm exec wrangler secret put BETTER_AUTH_SECRET
   ```

4. Build and deploy. `wrangler.jsonc` points at the build output, so build first:

   ```sh
   pnpm build
   pnpm run deploy
   ```

5. Open `/admin` on the `workers.dev` URL and create your admin account.

Create your admin account right after the first deploy. Until a user exists, `/admin/create-first-user` is open to anyone.

## Next

- [Custom domains](../deploy/custom-domains.md), which the edge cache needs.
- [Upgrading](../deploy/upgrading.md).
