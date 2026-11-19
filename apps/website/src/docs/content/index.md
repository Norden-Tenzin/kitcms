---
title: Using content
description: The ways to read and write content from your site and other Workers, and when to use each.
order: 1
---

This page compares the four ways to reach your content and points to the page for each.

| Way | Use it when | Page |
|---|---|---|
| **Local API** (`locals.cms`) | Your site and the admin run in the same Worker. | [The Local API](./local-api.md) |
| **Service Binding RPC** | Another Worker in your account reads or writes content. | [Headless over RPC](./rpc.md) |
| **REST** | A browser or third party that cannot use a Service Binding needs JSON over HTTP. | [REST](./rest.md) |
| **Generated types** | A consumer Worker needs the document types without your config. | [Generated types](./types.md) |

All of them run the same pipeline, so the same access rules, hooks and validation apply. See [Access control and hooks](../access/index.md).

## Which one first

In a full app, use `locals.cms`. It is a function call in the same isolate: no network hop, and fully typed from your config.

For a separate site or service, use RPC. A Service Binding is private to your account, has no public surface and needs no auth round trip. REST is the fallback for callers that cannot have a binding.

## Public reads

By default, a caller sees what an anonymous visitor sees: only what each collection's `read` rule allows, only published documents and only readable fields. Trusted server code can opt out of the rules with `overrideAccess` (Local API) or `{ as: 'system' }` (RPC).
