# Contributing to kitcms

Thanks for helping. This guide covers how to run kitcms locally, how to test a change, and the rules every change has to follow.

## Requirements

- Node 22 or newer
- pnpm (the version is pinned in `package.json` → `packageManager`, so `corepack enable` picks it up)
- No Cloudflare account. Everything runs locally against Miniflare's D1 and R2.

## Setup

```sh
pnpm install
cp apps/playground/.dev.vars.example apps/playground/.dev.vars
# put a random string of 32+ characters after BETTER_AUTH_SECRET=, e.g. from `openssl rand -base64 32`
pnpm --filter playground db:migrate   # create the local D1 tables
pnpm --filter playground db:seed      # optional: example content
pnpm dev                              # http://localhost:5173/admin
```

On the first visit, `/admin` asks you to create the first admin user.

## Repository layout

| Path                                                  | What it is                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`                                       | `@kitcms/core`: config, Local API, access control, hooks, D1 and R2, auth, SvelteKit integration, RPC entrypoint, the `kitcms` CLI |
| `packages/ui`                                         | `@kitcms/ui`: the Svelte 5 admin                                                                                                   |
| `packages/client`                                     | `@kitcms/client`: typed client for Workers that call kitcms over a Service Binding                                                 |
| `packages/plugin-multi-tenant`, `packages/plugin-seo` | Official plugins                                                                                                                   |
| `packages/create-kitcms`                              | The scaffolder (`pnpm create kitcms`)                                                                                              |
| `templates/blank`, `templates/website`                | Projects the scaffolder copies                                                                                                     |
| `apps/playground`                                     | A SvelteKit app that uses every package from the workspace. Use it to try changes and as the e2e target                            |
| `apps/playground-consumer`                            | A small Worker that reads from the playground over Service Binding RPC (the headless setup)                                        |
| `e2e`                                                 | Playwright admin tests and RPC contract tests, run under `wrangler dev`                                                            |

The apps are private and never published.

## The playground is local only

`apps/playground/wrangler.jsonc` has no `database_id`, so `pnpm dev`, `pnpm --filter playground preview` and the e2e tests all use local D1 and R2 state in `apps/playground/.wrangler/state`. To start from a clean database, delete that folder and run `db:migrate` again.

If you want to try the playground on your own Cloudflare account, create the resources (`wrangler d1 create`, `wrangler r2 bucket create`), add your `database_id` to a local copy of `wrangler.jsonc`, and don't commit it.

## Common commands

```sh
pnpm dev                                # playground in vite dev (site + admin, HMR for packages)
pnpm --filter playground preview        # build + wrangler dev (workerd, like production)
pnpm typecheck
pnpm lint
pnpm format
pnpm test                               # vitest over packages/*
pnpm test:e2e                           # Playwright (see e2e/README.md; run `pnpm exec playwright install chromium` once)
pnpm bench:bundle                       # Worker bundle size (dry run, nothing is deployed)
```

### Schema changes in the playground

The schema is code (`apps/playground/src/kitcms.config.ts`). After changing it:

```sh
pnpm --filter playground db:generate <name>   # writes drizzle/schema.ts and migrations/NNNN_<name>.sql
pnpm --filter playground db:migrate
pnpm --filter playground types                # regenerate types for the consumer
```

Read the generated SQL before committing it: renames show up as drop + add.

### Testing headless RPC

The RPC entrypoint (`KitcmsRPC`) is only served from a build, so run the playground with `wrangler dev`:

```sh
pnpm --filter playground preview              # terminal 1
pnpm --filter playground-consumer dev         # terminal 2, http://localhost:8788
```

Stop any running `pnpm dev` of the playground first. It registers the same Worker name without the entrypoint, and the consumer then fails with `Worker does not export an entrypoint named "KitcmsRPC"`.

For RPC with HMR there's an opt-in mode: `pnpm --filter playground dev:rpc` plus `pnpm --filter playground-consumer dev:rpc`.

## Rules for changes

- **Cloudflare Workers runtime only.** Runtime packages (`core` runtime code, `ui`, `client`, plugins) can't use `fs`, `path`, `process`, `Buffer` or native modules. Node is fine in build tooling: the CLI, codegen and tests.
- **D1 and R2 through bindings only,** behind the internal `DbAdapter` / `StorageAdapter` interfaces.
- **Schema is code only.** The admin must never create or edit collections, fields, blocks or forms.
- **One pipeline.** The Local API, RPC, REST and admin actions all go through access → hooks → validate → D1 → hooks. Don't query D1 around it.
- **Access control, auth, RPC trust and tenant isolation are security-critical.** Changes there need tests and a careful review. Please explain the threat model in the PR.
- TypeScript strict. Svelte 5 runes only (`$state`, `$derived`, `$props`, `$effect`): no stores, no `export let`.
- Nested data (group, array, blocks, json, richText) is stored as JSON `TEXT` columns. IDs are ULIDs. D1 has no interactive transactions, so use `batch()`.

## Commits, changesets and PRs

- Use [conventional commits](https://www.conventionalcommits.org/) scoped to the package: `feat(core): ...`, `fix(ui): ...`, `docs(client): ...`. Keep one logical change per commit.
- Add a changeset (`pnpm changeset`) for any user-facing change to a published package. All `@kitcms/*` packages and `create-kitcms` share one version.
- Before opening a PR, run `pnpm typecheck`, `pnpm lint` and `pnpm test`, plus `pnpm test:e2e` if you changed the admin, auth or RPC.

## Reporting security issues

Please don't open a public issue for a vulnerability. Report it privately through GitHub's security advisories for this repository.
