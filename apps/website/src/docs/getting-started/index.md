---
title: What is kitcms
description: A lightweight, Payload-style CMS for SvelteKit that runs only on Cloudflare Workers, D1 and R2.
order: 1
---

This page explains what kitcms is, how it is put together and where to go next.

kitcms is a CMS that installs into a SvelteKit app and runs only on **Cloudflare Workers, D1 and R2**. You define collections in code. kitcms creates the D1 schema from that code and serves your content through `locals.cms` and an admin UI.

## How it works

- **Schema is code.** Collections, globals, fields and blocks live in `src/kitcms.config.ts`. No admin screen creates or edits them, so the schema is reviewed, versioned and deployed like the rest of your app.
- **One pipeline.** The Local API, Service Binding RPC, the REST API and the admin all run every operation through the same steps: access, hooks, validation, D1, hooks. There is no side door. See [Access control and hooks](../access/index.md).
- **Cloudflare only.** kitcms reaches D1 and R2 through Worker bindings. It does not run on Node and supports no other database or storage. That keeps it small and lets it use platform features such as the Workers Cache API and D1 read replication.
- **Plain data.** Documents are rows in D1. Nested data (groups, arrays, blocks, JSON, rich text) is stored as JSON in text columns. IDs are ULIDs.

## Two ways to run it

- **Full app.** The admin and your site run in one Worker. Your routes call `locals.cms` and read content as the visitor.
- **Headless.** Other Workers read content through Service Binding RPC with `@kitcms/client`. See [Headless over RPC](../content/rpc.md).

## What you get

- An admin with list and edit views, drag-and-drop ordering, drafts, version history and live preview.
- Fields from `text` to `blocks` and rich text, with access rules and hooks at every level.
- R2 uploads with a media library.
- Email and password sign-in through Better Auth, with a first-user setup screen.
- A `kitcms` CLI for migrations, seeding and generated types.
- Plugins for SEO, contact forms and plan-based add-ons.

## Start here

1. [Requirements](./requirements.md): what you need on your machine and on Cloudflare.
2. [Installation](./installation.md): scaffold a project.
3. [Project tour](./project-tour.md): what the scaffold contains.
4. [Your first collection](./first-collection.md): add content to the schema and read it.
5. [Deploy in 5 minutes](./deploy-in-5-minutes.md): put it on Cloudflare.
