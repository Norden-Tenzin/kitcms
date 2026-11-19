---
title: Requirements
description: What you need on Cloudflare and on your machine to build and deploy a kitcms app.
order: 2
---

This page lists what a kitcms app needs on Cloudflare and what you need locally.

## On Cloudflare

- **Workers Paid plan.** Password hashing uses scrypt, which costs 85 to 250 ms of CPU per sign-in on a deployed Worker. The Workers Free plan allows 10 ms of CPU per request, so the admin cannot sign in there. A weaker hash that fits in 10 ms would not be a safe replacement, so kitcms keeps Better Auth's scrypt and requires the paid plan.
- **A D1 database.** It stores your content, users and sessions.
- **An R2 bucket.** It stores uploaded files.

kitcms runs only on Workers, D1 and R2. There is no Node server, other database or other storage backend.

You do not need a Cloudflare account to develop. `pnpm dev` runs against a local D1 and R2 that the Cloudflare adapter emulates on your machine.

## On your machine

- **Node.js 22.12 or newer**, for the `create-kitcms` scaffolder, the `kitcms` CLI and wrangler.
- **pnpm.** kitcms documents and tests pnpm only.
- **A Cloudflare account and `wrangler login`**, only when you create resources or deploy.

## Stack

A kitcms app is a SvelteKit 3 app with `@sveltejs/adapter-cloudflare`, Vite, TypeScript and Svelte 5. `pnpm create kitcms@latest` sets all of it up. kitcms components use Svelte 5 runes.

Do not set `declaration` in your `tsconfig.json`. With large configs, `declaration: true` fails with a TS7056 error.
