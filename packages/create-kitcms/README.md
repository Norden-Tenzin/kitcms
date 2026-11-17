# create-kitcms

Scaffolds a kitcms app: a SvelteKit project wired to `@kitcms/core` and `@kitcms/ui`, with a config, the admin route and a Cloudflare Worker setup (D1 and R2 bindings).

```sh
pnpm create kitcms@latest my-site
```

Then:

```sh
cd my-site
pnpm dev
```

## Options

```
create-kitcms: scaffold a kitcms app

Usage: pnpm create kitcms@latest [dir] [options]

Options:
  --template <name>     Template to use (blank). "website" is coming soon.
  --create-resources    Create the D1 database and R2 bucket with wrangler (needs "wrangler login")
  --yes, -y             Accept defaults, never prompt
  --no-install          Skip "pnpm install" and the local migration
  --link <repo>         Use link: dependencies on a local kitcms checkout (for testing)
  --help, -h            Show this help
```

Only the `blank` template ships in v1.

Status: pre-release (0.x), Cloudflare Workers + D1 + R2 only.
