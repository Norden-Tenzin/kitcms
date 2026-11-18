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
- [`@kitcms/plugin-seo`](packages/plugin-seo/README.md): SEO fields, meta tags and a search result preview
- [`create-kitcms`](packages/create-kitcms/README.md): the scaffolder (`pnpm create kitcms@latest`)

## Developing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short:

```sh
pnpm install
cp apps/playground/.dev.vars.example apps/playground/.dev.vars   # then set BETTER_AUTH_SECRET
pnpm --filter playground db:migrate
pnpm --filter playground db:seed   # demo content and photos
pnpm dev              # the playground at http://localhost:5173 (local D1/R2, no Cloudflare account needed)
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

The playground is **Halden Studio**, a fictional design studio site built with kitcms. Open `/` for the site, `/admin` for the admin (create the first user there), and `/lab` for plain pages that show field types, access rules and drafts working. Try switching page designs in the admin under Site settings → Design.

## License

[MIT](LICENSE)
