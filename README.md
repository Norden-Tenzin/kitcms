# kitcms

A lightweight, Payload-style CMS for SvelteKit that runs only on Cloudflare Workers, D1 and R2. It works as a full app (admin and site in one Worker) or headless, where other Workers read content through Service Binding RPC. Published as `create-kitcms` and `@kitcms/*`.

```sh
pnpm create kitcms@latest my-site
```

This repository is the monorepo for the packages, the templates and a local playground app.

## Packages

- [`@kitcms/core`](packages/core/README.md): config, the Local API, D1 and R2, auth, the SvelteKit integration, RPC and the `kitcms` CLI
- [`@kitcms/ui`](packages/ui/README.md): the Svelte 5 admin
- [`@kitcms/client`](packages/client/README.md): the typed Service Binding client for headless consumers
- [`@kitcms/plugin-multi-tenant`](packages/plugin-multi-tenant/README.md): several tenants in one CMS, with isolated data
- [`@kitcms/plugin-seo`](packages/plugin-seo/README.md): SEO fields, meta tags and a search result preview
- [`create-kitcms`](packages/create-kitcms/README.md): the scaffolder (`pnpm create kitcms@latest`)

## Developing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short:

```sh
pnpm install
cp apps/playground/.dev.vars.example apps/playground/.dev.vars   # then set BETTER_AUTH_SECRET
pnpm --filter playground db:migrate
pnpm dev              # the playground at http://localhost:5173/admin (local D1/R2, no Cloudflare account needed)
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

## License

[MIT](LICENSE)
