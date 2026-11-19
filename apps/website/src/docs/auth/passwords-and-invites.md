---
title: Passwords and invites
description: Reset a forgotten password and invite new users by email, with single-use links, lifetimes and rate limits.
order: 3
---

This page covers the two emailed links in the admin: "forgot password" and "email an invite", and the rules that keep them safe.

Both are built by kitcms. Better Auth's own reset endpoints stay closed. Both send an email, so both need [email](./email.md) to be set up.

## Invite a user

When you create a user in the admin (in the users collection), a checkbox reads **Email an invite: they choose their own password**. Tick it and leave the password out. The user gets an email with a link, opens it, chooses a password and is signed in.

The invite link works for **7 days**. If the email cannot be sent, kitcms deletes the user again and shows the error, so you never end up with an account nobody can reach.

You can still set a password yourself when you create a user. See [Auth and users](./index.md#creating-users-and-passwords).

## Forgot your password

The sign-in page has a **Forgot your password?** link to `/admin/forgot-password`. The user enters their email and gets a link to `/admin/reset-password`. The reset link works for **1 hour**.

## Links and tokens

- A link carries a random 256-bit token. kitcms stores only its SHA-256 hash, so a database leak does not reveal a usable link.
- A token is **single use**. It is deleted before the password is set, so opening the same link twice, or at the same moment, works only once.
- A new link for the same user replaces the older ones.
- Setting a password **revokes all of the user's sessions** and deletes their other tokens. The user is signed in again with the new password right after.

| Kind | Lifetime |
|---|---|
| Reset | 1 hour |
| Invite | 7 days |

An expired, used or unknown token shows "This link is invalid or has expired". The user can ask for a new one.

## What forgot-password reveals

The page answers the same way whether or not an account exists for the email: "If there is an account for that email, we have sent it a link". Nobody can use it to find out who has an account.

Only users who are allowed into the admin get a link. That is the same check as [`access.admin`](./index.md#who-can-use-the-admin). If sending the email fails, the user still sees the same message and the error goes to the Worker log.

## Rate limits

The counters live in D1, as for sign-in, and fail closed: if D1 cannot be reached, the request is refused.

| Action | Limit |
|---|---|
| Ask for a reset link | 5 per hour, per IP address and per email |
| Use a link to set a password | 10 attempts per 15 minutes, per IP address |

Over the limit, the page says "Too many requests. Try again later."

## Where the link points

Links use the origin in `BETTER_AUTH_URL` when it is set, and otherwise the origin of the request that asked for them. Set `BETTER_AUTH_URL` when the site is served on a custom domain and users might trigger an email from the `workers.dev` address. See [Auth and users](./index.md#configuration).

## Without email

If email is not configured (no `email` in the config, or no `send_email` binding in production):

- The **Forgot your password?** link is hidden on the sign-in page.
- `/admin/forgot-password` still opens, but shows "Email is not set up for this site" instead of the form.
- The create-user form does not offer **Email an invite**.

An admin can still set a password for a user by hand. Users who forgot theirs ask an admin to set a new one.

In `vite dev`, kitcms logs the email, including the link, to the console instead of sending it. That is how you try the flow locally.
