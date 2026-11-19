---
title: Plugins
description: How plugins extend a kitcms config, and the official plugins.
order: 1
---

This page explains what a plugin is and lists the official ones.

A plugin changes your config. It can add fields and collections, set hooks and access rules, answer site requests, mount API endpoints and add read-only admin panels. Plugins are plain code in the `plugins` array of `defineConfig()`:

```ts title="src/kitcms.config.ts"
import { defineConfig } from '@kitcms/core';
import { seo } from '@kitcms/plugin-seo';

export default defineConfig({
	collections: [/* ... */],
	plugins: [seo({ collections: ['pages'] })],
});
```

Plugins run in order when the config is sanitized, before it is validated. Every entry point sees the same result, so a plugin's fields are in the admin, the Local API, REST, RPC and the generated types.

Because the schema is code, so are plugins. Nothing in the admin installs one or changes what it adds. After you add a plugin that changes the schema, run `pnpm db:generate <name>` and `pnpm db:migrate`.

## Official plugins

| Plugin | What it does |
|---|---|
| [`@kitcms/plugin-seo`](./seo.md) | An SEO field group, plus redirects, `sitemap.xml`, `robots.txt` and a search result preview. |
| [`@kitcms/plugin-enquiries`](./enquiries.md) | Contact and booking forms defined in code, stored safely, with spam protection and email notification. |
| [`@kitcms/plugin-entitlements`](./entitlements.md) | Turns a plan from your platform into add-on gates and usage limits. |

## Write your own

See [Writing a plugin](./writing-a-plugin.md).
