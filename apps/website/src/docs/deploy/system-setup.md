---
title: System setup
description: Provision a deployment from a script with the token-protected seed and user endpoints, for platforms that run one Worker per customer.
order: 6
---

This page covers two HTTP endpoints that let a hosting platform fill a new kitcms deployment without a browser: run a seed and create the first admin.

They are for one case: a platform that uploads one Worker per customer and then needs to put starter content in its database and invite the customer. If you run a single site, you do not need them. Use `kitcms seed` and `/admin/create-first-user` instead (see [Deploy and operate](./index.md)).

## Security first

Anyone who holds the system token can create admin users on that deployment. Treat it like a database password.

- The endpoints are **off** until you set a token of at least 32 characters. With no token, or a shorter one, they answer `404`, as if they did not exist. Leave it unset if you do not need them.
- Keep the token in a Worker secret, never in `wrangler.jsonc` vars or in git. Use a different token for each deployment.
- Rotate it with `wrangler secret put`. The old value stops working at once.
- The token is compared in constant time, so response timing does not leak it.
- Callers are servers, so there are no cookies and no `Origin` check. The token is the only protection. Call the endpoints over HTTPS only.

```sh
openssl rand -base64 48 | pnpm exec wrangler secret put KITCMS_SYSTEM_TOKEN
```

To use another secret name, set `system.secret` in the config.

## Authenticate

Send the token as a bearer token. Bodies are JSON, at most 64 KiB, with `Content-Type: application/json`.

| Status | Meaning |
|---|---|
| `401` | The token is missing or wrong. |
| `404` | No token is configured on this deployment, or the seed name or path is unknown. |
| `400` | The body is invalid. `{ error, errors: [{ path, message }] }`. |
| `403` | The deployment is in [read-only mode](./read-only-mode.md), so writes are refused. |

## Run a seed

`POST /api/system/seed/:name` runs a seed you registered under that name in the config:

```ts title="src/kitcms.config.ts"
import { defineConfig, defineSeed, type Config, type SeedFn } from '@kitcms/core';

const starter = (input: unknown): SeedFn<Config> => {
	const siteName = (input as { siteName?: unknown } | undefined)?.siteName;
	if (typeof siteName !== 'string' || !siteName) throw new Error('siteName is required.');
	return defineSeed<Config>(async ({ ensure, ensureGlobal, log }) => {
		await ensureGlobal('site', { siteName });
		await ensure('pages', { where: { slug: { equals: 'home' } }, data: { title: 'Home', slug: 'home' } });
		log('seeded the starter content');
	});
};

export default defineConfig({
	system: { seeds: { starter } },
	collections: [/* ... */],
});
```

Each entry receives the request's `input` and returns the seed function. Validate `input`: it comes from the caller. Throw a `ValidationError` for a `400`.

Type the seed as `SeedFn<Config>`, not the default `SeedFn`. The default is your registered config, and the config refers to the seed, so the registered type would refer to itself. The cost is looser collection and field names inside the seed.

Seeds run inside the Worker, with the same helpers as `kitcms seed`: `ensure`, `ensureGlobal`, `ensureUpload` and `cms`, all acting as the system. There is no file system, so `ensureUpload` takes bytes (`{ bytes, filename }`), not a path. See [`kitcms seed`](../reference/cli.md#seed).

```sh
curl -X POST https://customer.example.com/api/system/seed/starter \
  -H "Authorization: Bearer $KITCMS_SYSTEM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "input": { "siteName": "Acme Bakery" } }'
```

```json
{
  "ok": true,
  "stats": { "pages": { "created": 1, "present": 0 }, "global:site": { "created": 1, "present": 0 } },
  "log": ["seeded the starter content"]
}
```

`stats` counts what the seed created and what was already there, per collection (globals are `global:<slug>`). Seeds are idempotent, so calling it again creates nothing twice.

## Create a user

`POST /api/system/users` makes sure a user exists and, by default, emails them an invite:

```sh
curl -X POST https://customer.example.com/api/system/users \
  -H "Authorization: Bearer $KITCMS_SYSTEM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "email": "owner@example.com", "name": "Sam Owner" }'
```

```json
{ "ok": true, "id": "01J9ZK3QY5N6E8W2H4T7B1CDXA", "created": true, "invited": true }
```

| Field | Default | What it does |
|---|---|---|
| `email` | required | Lowercased. Used to find an existing user. |
| `name` | required | Up to 200 characters. |
| `role` | `admin` | A role name from the users collection. |
| `invite` | `true` | Email a set-password link (valid 7 days). See [Passwords and invites](../auth/passwords-and-invites.md). |
| `origin` | the request's origin | The public `https://` origin the link points to. Set it to the customer's own domain. `localhost` is also accepted. |

The call is idempotent, so a provisioning step that is retried is safe:

- If the user exists, nothing is created (`created: false`).
- If the user already has a password, no invite is sent (`invited: false`), so a retry never resets someone who has finished setting up.
- If the user exists without a password, a new invite goes out and earlier links stop working.

Inviting needs [email](../auth/email.md) to be set up on the deployment. Without it the call fails after the user is created. Pass `"invite": false` to create the user only.
