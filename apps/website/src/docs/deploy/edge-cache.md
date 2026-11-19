---
title: Edge cache
description: Cache anonymous published reads in the Workers Cache API with cache.ttl, and know what it does and does not cover.
order: 3
---

This page explains the optional edge cache: how to turn it on, what it caches and when readers see a change.

```ts title="src/kitcms.config.ts"
import { defineConfig } from '@kitcms/core';

export default defineConfig({
	cache: { ttl: 60 },
	collections: [/* ... */],
});
```

`ttl` is a whole number of seconds, from 1 to 86400. The cache is off by default.

## It needs a custom domain

The Cache API does nothing on `*.workers.dev`. There, `cache` is harmless but has no effect. Attach a [custom domain](./custom-domains.md) first. If the cache is unavailable, reads fall back to D1.

## What it caches

Anonymous reads of the Local API: `find`, `findOne`, `findByID`, `count` and `findGlobal`. That covers public pages, anonymous RPC and anonymous REST.

It never caches:

- Reads by signed-in users.
- Reads with `draft: true`.
- Calls with `overrideAccess`.
- Calls that pass `req` or `context`.

Drafts and private content therefore never reach the cache.

## When changes show up

Entries are stored per data centre. Every write, from any caller, replaces a generation token.

- The data centre that handled the write serves fresh content at once.
- Other data centres keep their entries until `ttl` seconds pass.

So `ttl` is the longest a visitor in another region can see old content after an edit. Pick a value you are happy to wait for: 60 is a good start.

Cache keys include a fingerprint of your schema, so a deploy that changes the schema never reads old entries.

## Where it fits

The cache removes D1 round trips for repeat reads. For visitors far from your database, it works well together with [read replication and Smart Placement](./replication-and-placement.md).
