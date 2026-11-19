---
title: Requirements
description: What you need to build and deploy a kitcms app.
order: 2
---

## On Cloudflare

- **Workers Paid plan.** Password hashing uses scrypt, which costs 85 to 250 ms of CPU per sign-in on a deployed Worker. That exceeds the 10 ms CPU limit of the Workers Free plan, so the admin cannot sign in there.
- **A D1 database.** It stores your content, users and sessions.
- **An R2 bucket.** It stores uploaded files.

kitcms runs only on Workers, D1 and R2. There is no Node server, other database or other storage backend.

## On your machine

- **Node.js 22 or newer** and **pnpm**, for the `create-kitcms` scaffolder and the `kitcms` CLI.
- A Cloudflare account and `wrangler login`, only when you create resources or deploy. Local development uses a local D1 and R2 and needs no account.

## Stack

kitcms pairs with SvelteKit 3 and the Cloudflare adapter. `pnpm create kitcms@latest` sets all of this up for you.

