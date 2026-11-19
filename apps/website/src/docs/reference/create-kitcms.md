---
title: create-kitcms
description: Every create-kitcms flag, the prompts and the files it writes.
order: 3
---

This page is the reference for the `create-kitcms` scaffolder. For a walkthrough, see [Installation](../getting-started/installation.md).

```text
Usage: pnpm create kitcms@latest [dir] [options]

Options:
  --template <name>     Template to use: blank | website (default: blank)
  --create-resources    Create the D1 database and R2 bucket with wrangler (needs "wrangler login")
  --yes, -y             Accept defaults, never prompt
  --no-install          Skip "pnpm install" and the local migration
  --link <repo>         Use link: dependencies on a local kitcms checkout (for testing)
  --help, -h            Show this help
```

## Arguments and flags

| Argument or flag | What it does |
|---|---|
| `[dir]` | The directory to create. Its name becomes the app, Worker, D1 database and R2 bucket name. If you leave it out, the scaffolder asks (default `kitcms-app`). The directory must be empty. |
| `--template <name>` | `blank` or `website`. If you leave it out, the scaffolder asks (default `blank`). |
| `--create-resources` | Run `wrangler d1 create` and `wrangler r2 bucket create`, and write the `database_id` into `wrangler.jsonc`. Needs `wrangler login`. |
| `--yes`, `-y` | Never prompt. Use defaults for everything you did not pass. |
| `--no-install` | Skip `pnpm install` and the first local migration. |
| `--link <repo>` | Point the `@kitcms/*` dependencies at a local kitcms checkout. For developing kitcms. |
| `--help`, `-h` | Print the usage. |

An unknown option prints the usage and exits with `1`. So does an unknown template, a bad project name or a non-empty target directory.

## What it does

1. Copies the template and replaces the app, database, bucket and database ID placeholders.
2. Writes `.dev.vars` with a generated `BETTER_AUTH_SECRET`.
3. Runs `pnpm install` (unless `--no-install`).
4. In an interactive run with a logged-in wrangler, offers to create the Cloudflare resources. `--create-resources` does it without asking.
5. Runs `kitcms migrate:create init` and `kitcms migrate` to create the local database.
6. Prints the next steps and the deploy commands.

If a step fails, the scaffolder says what to run by hand and carries on.

## Templates

| Template | Contents |
|---|---|
| `blank` | The admin, a `media` upload collection and a `pages` collection with a draft/published `status`. |
| `website` | Pages made of blocks with live preview and drafts, a blog with tags, a team collection you can reorder, locked legal pages, a `site` global, seed content and Cloudflare image transformations. Run `pnpm kitcms seed` after scaffolding. |

Both include the generated admin and API routes, `src/kitcms.rpc.ts` and `wrangler.jsonc` with D1 (`DB`), R2 (`BUCKET`) and Smart Placement.

## Non-interactive use

For CI or scripts:

```sh
pnpm create kitcms@latest my-site --template website --yes --no-install
```
