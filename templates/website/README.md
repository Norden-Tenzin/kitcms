# __APP_NAME__

A [kitcms](https://kitcms.dev) website: SvelteKit + Cloudflare Workers + D1 + R2. A generic small business / studio site with pages built from blocks, a blog, a team page, legal pages and site settings.

> **Requires the Workers Paid plan to deploy.** Password hashing exceeds the Free plan's CPU limit.

## What is inside

| Content | Where | Notes |
|---|---|---|
| Pages | `pages` collection | Drafts + autosave. Sections are blocks. `home` is served at `/`, any other slug at `/<slug>`. SEO tab (title, description, social image). |
| Blog | `posts` + `tags` | Drafts, cover image, rich text body, tags. `/blog` (paginated) and `/blog/<slug>`. |
| Team | `team` | Drag to reorder in the admin list. Rendered by the `teamGrid` block. |
| Legal | `legal` | Locked: editors edit the text but cannot create or delete documents. `/legal/<slug>`, linked in the footer. |
| Site settings | `site` global | General tab: name, tagline, logo, navigation (a page, or a path like `/blog`), footer text and social links. Design tab: a design per page type and the colours (see Designs). |
| Media | `media` | Images and PDFs in R2. |

The blocks are `hero`, `richText`, `features`, `gallery`, `cta`, `teamGrid` and `latestPosts`.

## Setup

```sh
pnpm install
cp .dev.vars.example .dev.vars   # then set BETTER_AUTH_SECRET (the scaffolder already did this)
pnpm db:generate init            # generate the first migration from src/kitcms.config.ts
pnpm db:migrate                  # apply it to the local D1
pnpm db:seed                     # example pages, posts, tags, team, legal pages and site settings
pnpm dev
```

Open <http://localhost:5173> for the site and <http://localhost:5173/admin> for the admin. The first visit to the admin asks you to create the first admin user.

`pnpm db:seed` (`kitcms seed`) is idempotent: it only creates what is missing and never overwrites edits. It seeds no images; upload some in the admin and attach them (hero image, post covers, team photos, logo).

## Commands

| Command | |
|---|---|
| `pnpm dev` | Dev server with local D1/R2. |
| `pnpm preview` | Build and run under `wrangler dev` (workerd, like production). |
| `pnpm db:generate <name>` | Generate a migration after you change `src/kitcms.config.ts`. |
| `pnpm db:migrate` / `pnpm db:migrate:remote` | Apply migrations to the local / production D1. |
| `pnpm db:seed` / `pnpm db:seed:remote` | Run `src/kitcms.seed.ts` against the local / production D1. |
| `pnpm types` | Regenerate the typed config declarations. |
| `pnpm check` | `svelte-check`. |
| `pnpm run deploy` | `wrangler deploy`. |

## Where things live

- `src/kitcms.config.ts`: the schema (collections, globals, blocks). The only place it exists.
- `src/lib/blocks/`: one Svelte component per block, plus `RenderBlocks.svelte` (maps `blockType` to its component).
- `src/kitcms.admin.ts`: registers the **live preview** of every block (loaded lazily in the admin). Previews use the same components as the public site through `src/lib/blocks/AdminPreview.svelte`, so what editors see is what visitors get. `teamGrid` and `latestPosts` show a placeholder in the preview because they render other collections.
- `src/routes/(site)/`: the public routes. They read content with `locals.cms` (the Local API acting as the visitor: only published documents). `src/lib/content.ts` loads a page and the data its blocks need.
- `src/lib/site.css`: design tokens (light/dark follows the system setting), base styles, buttons and generic form styles, shared by the site and the preview.
- `src/lib/designs.ts`: the design registry and `resolveDesign` (see Designs).
- `src/lib/shell/`: the header (with the accessible mobile menu), the footer and `buildShell`.
- `src/kitcms.seed.ts`: example content.
- `src/routes/(kitcms)/`: generated admin and API routes. Do not edit them.

To add a block: define it with `block()` in the config, add `src/lib/blocks/<Name>.svelte`, add a branch in `RenderBlocks.svelte` and `AdminPreview.svelte`, and register it in `src/kitcms.admin.ts`.

The slugs `blog`, `legal`, `admin` and `api` are taken by routes, so a page with one of those slugs would be shadowed.

## Designs and colours

Every page type comes in three designs, **A**, **B** and **C**. They are different compositions, not colour swaps, and all three share one set of tokens, so any mix stays coherent.

| Page type | A | B | C |
|---|---|---|---|
| Header | Bar | Centred | Band |
| Footer | Simple | Columns | Statement |
| Home / Page (every block) | Editorial | Immersive | Structured |
| Blog list (also the `latestPosts` block) | Journal | Cards | Index |
| Blog post | Essay | Feature | Article |

- **Choose** in the admin: Site settings > Design has one select per page type. A page or post can override it in its sidebar (**Design**); the home page (slug `home`) uses the `home` setting, any other page the `page` setting. An unset page override means "use the site setting".
- **How it resolves:** `resolveDesign(type, site.design, page.design)` in `src/lib/designs.ts` returns `'a' | 'b' | 'c'`. The route passes it to `PageView` / `RenderBlocks`, and every block takes a `design` prop and renders all three. Unknown ids fall back to the first design. In dev, `?header=b` and `?footer=c` preview a header or footer without saving.
- **Add a design** to a page type: add `d: 'Name'` to its entry in `PAGE_TYPES` (`src/lib/designs.ts`); the admin selects are built from that list. Then handle `'d'` in the components that switch on `design`. **Add a page type**: add it to `PAGE_TYPES`, a `siteDesign('<type>')` line in the config's Design tab and a route that calls `resolveDesign`.
- **Colours:** Site settings > Design > Colours sets the accent, background and text colour (hex). They become the CSS variables `--accent`, `--bg` and `--ink` on the page; the surface, muted text and lines are derived from them, and the text on the accent is picked for contrast. The values are validated in the config and again when rendered (anything that is not a hex colour is dropped). Set all three together, and check contrast: the defaults follow the system light/dark setting, overrides do not.
- **Fonts:** one self-hosted family (`@fontsource-variable/hanken-grotesk`, imported in `src/app.css`) plus a system serif for the editorial design. Change them in `site.css` (`--font-sans`, `--font-serif`).
- **Layout rules:** mobile first (320 px up), no horizontal scroll, 44 px tap targets, visible focus, `prefers-reduced-motion`, a skip link and landmarks. Forms: the base CSS styles plain `input`, `select`, `textarea`, `label` and `button`.

## Custom domain: edge cache and image transformations

Two features need your own domain on Cloudflare and do nothing on `*.workers.dev`:

- **Edge cache.** `cache: { ttl: 60 }` in the config caches anonymous published reads (the public site) with the Workers Cache API. A write clears the cache in the editor's region at once; other regions serve a cached read for up to `ttl` seconds. Without a custom domain it is a no-op, which is harmless.
- **Image transformations.** `src/lib/image.ts` builds `/cdn-cgi/image/width=...,format=auto/<url>` URLs, so visitors get resized AVIF/WebP images. Enable *Transformations* for the zone in the Cloudflare dashboard (Images). The template turns them off in dev and on `*.workers.dev` and serves the original file instead.

## Deploy

1. Create the resources if you have not (`wrangler d1 create __DB_NAME__`, `wrangler r2 bucket create __BUCKET_NAME__`) and put the D1 `database_id` into `wrangler.jsonc`.
2. `pnpm db:migrate:remote`
3. `pnpm exec wrangler secret put BETTER_AUTH_SECRET`
4. For `pnpm db:seed:remote`, add `"remote": true` to the `d1_databases` entry in `wrangler.jsonc` temporarily (so the seed reaches the real database), then remove it.
5. `pnpm run deploy`

`wrangler.jsonc` enables Smart Placement (the Worker runs near the D1 primary when that is faster; kitcms makes a few D1 round trips per request).

D1 read replication is optional and needs no code changes: turn it on in the Cloudflare dashboard (D1 → your database → Settings → Read replication). Visitors then read from the nearest replica, and signed-in editors still see their own saves. See the `@kitcms/core` README.

## Headless / RPC

`src/kitcms.rpc.ts` exports the `KitcmsRPC` entrypoint. Other Workers can bind to it with a Service Binding
(`"services": [{ "binding": "CMS", "service": "__APP_NAME__", "entrypoint": "KitcmsRPC" }]`) and read content over RPC.
