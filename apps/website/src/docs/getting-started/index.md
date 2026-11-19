---
title: What is kitcms
description: A lightweight, Payload-style CMS for SvelteKit that runs only on Cloudflare Workers, D1 and R2.
order: 1
---

kitcms is a CMS that installs into a SvelteKit app and runs only on **Cloudflare Workers, D1 and R2**. You define collections in code; kitcms creates the D1 schema from that code and serves them through `locals.cms` and an admin UI.

It works in two ways:

- **Full app.** The admin and your site run in one Worker.
- **Headless.** Other Workers read content through Service Binding RPC with `@kitcms/client`.

## Create a project

```sh
pnpm create kitcms@latest my-site
```

Then start it:

```sh
cd my-site
pnpm dev
```

The scaffolder has two templates: `blank` (the admin plus one minimal `pages` collection) and `website` (a small business site with blocks, a blog, a team page, legal pages and site settings). Choose one with `--template`.

## Where to go next

- [Requirements](./requirements.md): what you need on your machine and on Cloudflare.
- [Configuration](../configuration/index.md): the config file that defines your content.
- [Deploy & operate](../deploy/index.md): putting it on Cloudflare.
