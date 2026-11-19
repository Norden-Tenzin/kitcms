---
title: Auth and users
description: How the first admin is created, how roles and the users collection work, how users get passwords and how sign-in is protected.
order: 1
---

This page covers users in kitcms: the first admin, the users collection, roles, creating users, passwords and sign-in security. Emailed invites and password resets have [their own page](./passwords-and-invites.md).

kitcms uses [Better Auth](https://www.better-auth.com) for email and password sign-in. You never call it directly. kitcms wraps it so users go through the same pipeline as every other document.

## The first user

A new database has no users. The first visit to `/admin` redirects to `/admin/create-first-user`, where you enter a name, an email and a password (at least 8 characters). That user gets the `admin` role. Once any user exists, the page redirects to the sign-in screen and cannot create another.

Create your admin account right after the first deploy. Until a user exists, `/admin/create-first-user` is open to anyone.

If two requests try to create the first user at the same time, both roll back and fail. D1 has no interactive transactions, so this is the safe outcome. Try once more.

## The users collection

kitcms adds a `users` collection to every config that has no `auth: true` collection. To add your own fields, define the collection yourself:

```ts title="src/kitcms.config.ts"
import { collection, fields as f } from '@kitcms/core';

export const users = collection({
	slug: 'users',
	auth: true,
	admin: { useAsTitle: 'name' },
	fields: {
		role: f.select({
			options: ['admin', 'editor', 'author'],
			defaultValue: 'editor',
			required: true,
		}),
		bio: f.textarea(),
	},
});
```

At most one collection may set `auth: true`. It always has these fields:

| Field | Notes |
|---|---|
| `email` | Required, unique. Stored lowercased. |
| `name` | Required. |
| `role` | A `select`. Built in: `admin` and `editor`, default `editor`. |
| `emailVerified`, `image` | Hidden in the admin. |

The names `email`, `name`, `emailVerified` and `image` are reserved.

## Roles

A user has one `role`. You can define your own `role` select field to change the options. It must be a top-level `select` field and must include an `admin` option.

The `admin` role is special in the defaults:

- Only admins can create and delete users.
- Only admins can change `role` and `emailVerified`.
- A user can update their own document. Admins can update anyone.

Beyond that, roles mean what your access rules say. Write rules as functions of `req.user.role`. See [Access rules](../access/rules.md).

### Who can use the admin

By default, a user can open the admin when their `role` is one of the role field's options. Narrow it with `access.admin` on the auth collection:

```ts
access: { admin: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor' },
```

A signed-in user who is not allowed into the admin is refused, never redirected in.

## Creating users and passwords

There is no public sign-up. Better Auth's sign-up route is turned off, so nobody can register through `/api/auth`.

Admins create users in the admin, in the users collection, by entering a name, an email and a password. The new user can then sign in with those details. With [email](./email.md) set up, the form can instead **email an invite**, and the user chooses their own password.

Passwords:

- **Changing a password.** Admins can set anyone's password. Anyone else can change only their own, and must enter the current password.
- **Sessions.** After a password change, the target's other sessions are revoked.
- **Forgot your password.** With email set up, the sign-in page links to a reset flow. See [Passwords and invites](./passwords-and-invites.md).

## Sign-in security

- Sign-in is rate limited per IP address and per email: 5 attempts per minute each. The counters live in D1, because memory is not shared between Worker isolates. If D1 cannot be reached, sign-in fails closed.
- A wrong email and a wrong password give the same error.
- The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS.
- Every admin action and every write over REST needs a same-origin `Origin` header, which protects against cross-site request forgery.

## Configuration

Secrets and variables:

| Name | Where | What it does |
|---|---|---|
| `BETTER_AUTH_SECRET` | `.dev.vars` locally, `wrangler secret put BETTER_AUTH_SECRET` when deployed | Signs sessions. Required. |
| `BETTER_AUTH_URL` | Optional variable | The public origin of your site. Set it when Better Auth cannot work out the origin from the request. Only the origin is used. Also the origin of password and invite links. |

Session options go to `kitcms()` in `hooks.server.ts`:

```ts title="src/hooks.server.ts"
import { kitcms } from '@kitcms/core/sveltekit';
import config from './kitcms.config';

export const handle = kitcms({
	config,
	auth: { cookieCache: { maxAge: 60 } },
}).handle;
```

`cookieCache` adds a signed cookie that lets a session resolve without a D1 read for `maxAge` seconds. It is off by default, because a revoked session or a changed role would stay valid for up to `maxAge` seconds.

## In your routes

`locals.user` and `locals.session` are resolved only for `/admin` and `/api` requests. On public routes they are `null` and `locals.cms` acts as an anonymous visitor. That keeps public pages free of auth work and cacheable.

## Why Workers Paid

Password hashing uses scrypt, which exceeds the 10 ms CPU limit of the Workers Free plan. See [Requirements](../getting-started/requirements.md).
