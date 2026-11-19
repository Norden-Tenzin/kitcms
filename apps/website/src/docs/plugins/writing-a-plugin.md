---
title: Writing a plugin
description: Build a plugin with a config transform, a site handle, API endpoints and read-only admin panels.
order: 5
---

This page shows how to write a plugin: its shape, what each part can do and the security rules that apply.

A plugin is an object of type `KitcmsPlugin`:

| Property | What it does |
|---|---|
| `name` | Required. Shown in config errors. Plugins with `endpoints` or `admin.panels` use it as a URL segment, so it must be lowercase letters, digits and `-`, starting with a letter. Unique per config. |
| `config(config)` | Returns a new config: add collections or fields, set hooks and access. Runs when the config is sanitized. |
| `handle` | Runs for site requests before routing. Return a `Response` to answer. |
| `endpoints` | API routes at `/api/plugins/<name>/<path>`. |
| `admin.panels` | Read-only panels in the admin. |
| `entitlement` | Gates the plugin behind an add-on. See [Entitlements](./entitlements.md). |

## An example

This plugin adds a hidden `views` counter to chosen collections, counts views through a public endpoint and shows the total in an admin panel.

```ts title="src/plugins/page-views.ts"
import { fields as f, type KitcmsPlugin } from '@kitcms/core';

export function pageViews(options: { collection: string }): KitcmsPlugin {
	return {
		name: 'page-views',

		// 1. Change the config.
		config: (config) => ({
			...config,
			collections: config.collections.map((c) =>
				c.slug === options.collection
					? {
							...c,
							fields: {
								...c.fields,
								views: f.number({ integer: true, defaultValue: 0, admin: { readOnly: true } }),
							},
						}
					: c,
			),
		}),

		// 2. Answer site requests.
		handle: ({ path }) => {
			if (path === '/ping') return new Response('pong');
		},

		// 3. Mount endpoints at /api/plugins/page-views/...
		endpoints: [
			{
				method: 'POST',
				path: 'hit/:slug',
				access: 'public',
				rateLimit: { max: 60, window: 60 },
				handler: async ({ params, cms }) => {
					const slug = params.slug;
					if (!slug) return Response.json({ error: 'Missing slug.' }, { status: 400 });
					const doc = await cms.findOne(options.collection, { where: { slug: { equals: slug } } });
					if (!doc) return Response.json({ error: 'Not found.' }, { status: 404 });
					const views = typeof doc.views === 'number' ? doc.views : 0;
					await cms.update(options.collection, doc.id, { views: views + 1 }, { overrideAccess: true });
					return Response.json({ views: views + 1 });
				},
			},
		],

		// 4. Add a read-only admin panel.
		admin: {
			panels: [
				{
					id: 'summary',
					label: 'Page views',
					load: async ({ cms }) => {
						const { docs } = await cms.find(options.collection, { sort: '-views', limit: 5 });
						return {
							blocks: [
								{ type: 'heading', text: 'Most viewed' },
								{
									type: 'list',
									items: docs.map((d) => ({ label: String(d.title ?? d.id), description: `${d.views ?? 0} views` })),
								},
							],
						};
					},
				},
			],
		},
	};
}
```

Use it like any plugin: `plugins: [pageViews({ collection: 'pages' })]`. After a plugin that adds fields, run a migration.

## The config transform

`config(config)` receives the config so far and must return a new one. Do not mutate it. Plugins run in the order of the `plugins` array, each on the result of the previous one. The result is validated like any config, so a plugin that produces an invalid collection fails at startup with a clear error path.

Throw an error whose message starts with your plugin's name when a precondition fails, as `@kitcms/plugin-seo` does when a listed slug does not exist.

## `handle`

`handle({ event, path, cms })` runs for every request **outside** `/admin` and `/api`, before routing. `path` is the request path relative to the app's base path. Return a `Response` to answer. Return nothing to continue. The first plugin to return a response wins.

`cms` is the Local API acting as an anonymous visitor. Pass `overrideAccess: true` for trusted reads.

## Endpoints

Each endpoint has a `method` (`GET`, `POST`, `PATCH` or `DELETE`), a `path` and a `handler`.

- **`access` is required** and has no default: `'public'` (anyone, so rate limit it), `'signedIn'` (any signed-in user, 401 otherwise) or `'admin'` (users with admin access, 401 or 403 otherwise).
- **`path`** is relative to `/api/plugins/<name>/`: segments of letters, digits, `.`, `_` and `-`, or `:param`. Values arrive decoded in `ctx.params`.
- **`maxBodyBytes`** caps the request body for `ctx.body`. Default 64 KiB, at most 1 MiB. Larger bodies get 413.
- **`rateLimit: { max, window }`** is a fixed window per client IP, counted in D1 before the handler runs. Over the limit gets 429. If D1 cannot be reached, the request fails closed.
- Non-`GET` requests must be same-origin, as for the rest of the API.

The handler gets a context:

| Property | What it is |
|---|---|
| `event` | The SvelteKit request event. |
| `params` | The `:param` values. |
| `user` | The signed-in user, or `null`. |
| `cms` | The Local API acting as the caller (anonymous when signed out). |
| `body` | `json()`, `form()` or `text()`. Read at most once, and capped. |
| `email` | The [email sender](../auth/email.md). |
| `ip` | `cf-connecting-ip`, or `null` in local dev. |
| `runtime` | `{ env, cms }`: the Worker env and a read-only system Local API. Pass it to `resolveValue()` for [per-request values](../configuration/per-request-values.md). |

Handlers return a `Response`. Throw `ValidationError`, `ForbiddenError` or another kitcms error from `@kitcms/core` and core maps it to the right status.

## Admin panels

A panel is read-only: it has no actions. `load({ req, cms, runtime })` returns serializable content, and core validates it before it reaches the browser.

| Block | Shape |
|---|---|
| `heading` | `{ type: 'heading', text }` |
| `text` | `{ type: 'text', text, tone? }` |
| `keyValue` | `{ type: 'keyValue', items: [{ label, value, tone? }] }` |
| `meter` | `{ type: 'meter', label, used, limit, unit? }`. `limit: null` means unlimited. |
| `list` | `{ type: 'list', items: [{ label, description?, status?, href? }] }`. `status` is `'on'`, `'off'` or `'locked'` for features, or `'done'` or `'todo'` for a checklist. `href` makes the label a link. |
| `link` | `{ type: 'link', label, href }`. `href` must be `https:` or `/`-relative. |

`tone` is `'default'`, `'ok'`, `'warning'` or `'muted'`. A panel has an `id` (lowercase letters, digits and `-`), a `label`, an optional `group` for navigation and an optional `access` rule. By default, every user with admin access sees it. It is served at `/admin/plugins/<name>/<id>`.

### On the dashboard

Set `dashboard: true` on a panel to also show its content at the top of the admin dashboard, such as an onboarding checklist. A dashboard panel that fails to load is left out, and the dashboard still works. It follows the panel's `access` rule.

```ts
{
	id: 'setup',
	label: 'Getting started',
	dashboard: true,
	load: async ({ cms }) => {
		const { docs } = await cms.find('pages', { limit: 1 });
		return {
			blocks: [
				{
					type: 'list',
					items: [
						{ label: 'Write your first page', status: docs.length ? 'done' : 'todo', href: '/admin/collections/pages' },
					],
				},
			],
		};
	},
},
```

## Options that can differ per site

If your plugin takes an option that one deployment of the build may want to set differently, type it as `Resolvable<T>` and read it with `resolveValue(option, ctx.runtime)` in an endpoint, or with the `runtime` a panel receives. Both come from `@kitcms/core`. Check constants when the plugin is created, and check a function's result when you use it.

## One pipeline

Plugin code reads and writes content through the Local API it is given, so access, hooks and validation still apply. Do not reach around it to D1. A plugin that needs to write on behalf of an anonymous visitor, as the example does, passes `overrideAccess: true` in code you control, and never takes that flag from the request.
