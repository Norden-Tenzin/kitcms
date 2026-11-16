# kitcms

A lightweight, Payload-style CMS for SvelteKit that runs only on Cloudflare Workers, D1 and R2. It works as a full app (admin and site in one Worker) or headless, where other Workers read content through Service Binding RPC. Published as `create-kitcms` and `@kitcms/*`.

This repository is the monorepo for the packages and the playground apps. The roadmap lives in `plans/kitcms-plan.md` (not committed).

## Commands

```sh
pnpm install          # install workspace dependencies
pnpm dev              # run the playground app (apps/dev)
pnpm build            # build all packages and apps
pnpm typecheck        # typecheck every package and app
pnpm lint             # eslint the repo
pnpm format           # prettier --write
pnpm test             # vitest run
pnpm changeset        # add a changeset for a user-facing change
```
