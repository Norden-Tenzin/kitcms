---
title: Upgrading
description: Move a kitcms app to a newer version safely, and what the semver policy promises.
order: 5
---

This page shows how to upgrade the kitcms packages in an app and what to check each time.

## How versions work

All `@kitcms/*` packages and `create-kitcms` release together under one version number, so `@kitcms/core` and `@kitcms/ui` always match. Upgrade them together.

The full promise is in the [semver and upgrade policy](../reference/semver.md).

## Upgrade steps

1. **Read the changelog.** Each package has a `CHANGELOG.md`. A release that needs a schema change or code change says so, with upgrade steps.
2. **Bump all kitcms packages together**, then install:

   ```sh
   pnpm up @kitcms/core @kitcms/ui @kitcms/client @kitcms/plugin-seo --latest
   ```

   List the ones your app uses.
3. **Check your project.** Run `pnpm exec kitcms info`, `pnpm check` and your tests.
4. **Regenerate types** if you use them in a headless consumer: `pnpm types`.
5. **Migrate if needed.** If the changelog mentions a schema change, generate and review a migration:

   ```sh
   pnpm db:generate upgrade
   ```

   A release that changes the database mapping ships a migration path. If an upgrade produces a migration you did not expect, stop and read it before applying.
6. **Apply and deploy**, in this order:

   ```sh
   pnpm exec kitcms migrate --remote
   pnpm build && pnpm run deploy
   ```

## Before 1.0

While kitcms is at `0.x`, a **minor** release (`0.1` to `0.2`) may include breaking changes, written up with upgrade steps in its changeset. A **patch** release (`0.1.0` to `0.1.1`) never breaks. Pin the minor you use, for example `~0.1.0`, and move between minors on purpose.

## Headless setups

A consumer Worker's `@kitcms/client` and the CMS Worker's `@kitcms/core` deploy separately. Within a major version:

- The server accepts every method and option from earlier minors.
- The client never sends options that an older server of the same major would reject, unless you pass them.
- The error format `kitcms:<CODE>:<status>: <message>` never changes.

So deploy the CMS first, then update consumers. Do not use an option from a new client against a CMS that has not been upgraded.

## Security fixes

A patch release may tighten behaviour to fix a security problem, by failing closed. The changelog says when it does. If an access rule, auth flow or RPC call starts denying something it allowed before, check the changelog first.

## Generated files

Files with a `GENERATED` comment come from kitcms: the admin and API route files and `src/kitcms.rpc.ts`. If an upgrade changes them, the changelog says so. Compare them with a fresh scaffold (`pnpm create kitcms@latest` in a temporary directory) and copy any change.
