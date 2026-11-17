# e2e

Playwright tests for the kitcms admin and the Service Binding RPC contract, run against the
**built** `apps/dev` under `wrangler dev` (workerd), chromium only.

## Run

```sh
pnpm exec playwright install chromium   # once (from e2e/ or the repo root)
pnpm test:e2e                           # from the repo root
pnpm --filter e2e test -- --project=admin -g "tenancy"   # a subset
```

`E2E_SKIP_BUILD=1 pnpm test:e2e` reuses the existing `apps/dev/.svelte-kit` build. Ports 8801 (CMS),
8802 (consumer), 9331 and 9332 (inspectors) must be free.

## What starts

`playwright.config.ts` starts two web servers, in order:

1. `scripts/prepare.mjs` (wipes the state dir, `pnpm --filter dev build`, applies the D1 migrations),
   then `wrangler dev` for `apps/dev` on **8801**.
2. `wrangler dev` for `apps/dev-consumer` on **8802** with `--var E2E:1`, bound to the CMS over
   Service Binding RPC (`KitcmsRPC`). The consumer's `/e2e/call` proxy (`E2E=1` only) is what
   `tests/rpc.spec.ts` talks to.

## State

Everything lives in `<repo>/.e2e-state` (gitignored, deleted at the start of every run): the local D1
and R2 (`--persist-to`), the dev registry that links the two Workers (`WRANGLER_REGISTRY_PATH`),
and the saved admin session (`admin.json`). Your `apps/dev/.wrangler` state is never read or written,
and nothing touches Cloudflare (no `--remote`). The database starts empty and is **not seeded**
(`kitcms seed` always uses the default persist dir), so tests create what they need through the
admin or the API. `BETTER_AUTH_SECRET` is passed with `--var`.

## Projects (run in this order, one worker)

| Project | Files | Notes |
| --- | --- | --- |
| `auth` | `auth.spec.ts` | First-user setup, logout, wrong/right password; saves the session |
| `admin` | `admin-*.spec.ts` | Pages, preview, media, orderable team, globals, versions, tenancy, CSRF smoke |
| `rpc` | `rpc.spec.ts` | Access, drafts, system calls, error wire format, tenant scoping over RPC |

Titles are unique per run (`uid()` in `tests/helpers.ts`); there are no sleeps.
