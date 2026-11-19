---
title: Installation
description: Create a kitcms project with create-kitcms.
order: 3
---

This page shows how to scaffold a kitcms app, what the prompts ask and what the script does for you.

## Create a project

```sh
pnpm create kitcms@latest my-site
```

When you leave out the template or the name, the scaffolder asks. With `--yes` it takes the defaults and never prompts.

When it finishes, it prints the next steps:

```sh
cd my-site
pnpm dev
```

Open `http://localhost:5173/admin`. The database has no users yet, so the admin asks you to create the first admin account.

## What the scaffolder does

1. Copies the template into the new directory and fills in the project name.
2. Writes `.dev.vars` with a `BETTER_AUTH_SECRET` for local development.
3. Runs `pnpm install`.
4. Optionally creates the D1 database and R2 bucket on your Cloudflare account.
5. Generates the first migration (`kitcms migrate:create init`) and applies it to the local D1.

If a step fails, it tells you which commands to run by hand.

## Templates

| Template | What it is |
|---|---|
| `blank` | The admin, one `media` upload collection and one minimal `pages` collection. The default. |
| `website` | A small business site: pages built from blocks with live preview, a blog with tags, a team page, locked legal pages, site settings and image transformations. Run `pnpm kitcms seed` after scaffolding to fill it with example content. |

Choose one with `--template blank` or `--template website`.

## Options

| Flag | Effect |
|---|---|
| `--template <name>` | `blank` or `website`. Default `blank`. |
| `--create-resources` | Create the D1 database and R2 bucket with wrangler. Needs `wrangler login`. |
| `--yes`, `-y` | Accept the defaults and never prompt. |
| `--no-install` | Skip `pnpm install` and the local migration. |
| `--link <repo>` | Use `link:` dependencies on a local kitcms checkout. For testing kitcms itself. |
| `--help`, `-h` | Print the help. |

The project name becomes the Worker name, the D1 database name and the R2 bucket name. The scaffolder validates the name and refuses a target directory that is not empty.

## Cloudflare resources

With `--create-resources`, or if you answer yes when the scaffolder offers, it runs `wrangler d1 create` and `wrangler r2 bucket create` and writes the database ID into `wrangler.jsonc`. Wrangler must be logged in.

If you skip this, create the resources before you deploy. See [Deploy and operate](../deploy/index.md).

## Next

Take the [project tour](./project-tour.md).
