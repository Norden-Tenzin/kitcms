---
title: Read replication and Smart Placement
description: Speed up reads for visitors far from your D1 database with D1 read replication and Smart Placement.
order: 4
---

This page explains two Cloudflare features that help when your visitors are far from the D1 primary, and what kitcms does with them.

## D1 read replication

kitcms already uses the D1 Sessions API on every request, so replication needs no code change. Turn it on for your database in the Cloudflare dashboard: **D1, your database, Settings, Read replication**.

Then:

- **Anonymous requests** (public pages, anonymous REST and RPC reads) read from the nearest replica.
- **Signed-in users** carry a bookmark in an `HttpOnly` cookie named `kitcms-d1`, so editors always see their own saves.
- **RPC calls with `as: 'system'`** start on the primary, because they may write and then read.
- **Sign-in and sessions** always use the primary, so a session reads its own latest writes.

With replication off, every session reads from the primary. Replication helps most when the edge cache misses and the visitor is far from the primary.

## Smart Placement

Smart Placement can run the Worker near the database instead of near the visitor. kitcms makes several D1 round trips per request, so running near the database is often faster than running near the visitor and crossing the world for each query.

The templates turn it on:

```jsonc title="wrangler.jsonc"
{
	"placement": { "mode": "smart" }
}
```

Smart Placement decides from real traffic whether it helps, and does nothing when it does not.

## Which to use

| Situation | What helps |
|---|---|
| Mostly anonymous reads, global audience | The [edge cache](./edge-cache.md), plus read replication. |
| Mostly signed-in editing | Smart Placement. Editors read from the primary anyway. |
| Audience near the database | Either is optional. |

Measure on your own traffic. Both are easy to turn off.
