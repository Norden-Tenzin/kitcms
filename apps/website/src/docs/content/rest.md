---
title: REST
description: The JSON API under /api/collections and /api/globals, with its routes, parameters, auth and errors.
order: 3
---

This page lists the REST routes, their parameters and how they are authenticated.

REST is a fallback for browsers and third parties that cannot use a Service Binding. On Cloudflare, prefer [RPC](./rpc.md): it has no public surface and no auth round trip.

The generated `src/routes/(kitcms)/api/[...path]/+server.ts` serves it. If your app was scaffolded earlier, check that the file exports `GET`, `POST`, `PATCH` and `DELETE`:

```ts title="src/routes/(kitcms)/api/[...path]/+server.ts"
export { GET, POST, PATCH, DELETE } from '@kitcms/core/sveltekit/api';
```

## Routes

| Route | Action |
|---|---|
| `GET /api/collections/:slug` | `find`, paginated |
| `POST /api/collections/:slug` | `create` (201). Not for upload or auth collections (405). |
| `GET /api/collections/:slug/:id` | `findByID` (404 when missing) |
| `PATCH /api/collections/:slug/:id` | `update` |
| `DELETE /api/collections/:slug/:id` | `delete` |
| `POST /api/collections/:slug/:id/move` | Body `{ "before": id }` or `{ "after": id }`. Orderable collections. |
| `POST /api/collections/:slug/:id/unpublish` | Take a published document offline. |
| `GET /api/globals/:slug` | `findGlobal` |
| `PATCH /api/globals/:slug` | `updateGlobal` |

## Parameters

Reads take these query parameters:

| Parameter | What it does |
|---|---|
| `where` | A JSON object, with the same syntax as the Local API. |
| `sort` | A field, with `-` for descending: `-createdAt`. |
| `limit`, `page` | Pagination. Plain integers, or the response is `400`. |
| `depth` | `0` to `2`. |
| `pagination=false` | Skip the total count. |
| `draft=true` | Include drafts. Signed-in users only. |

Writes take `depth` and `draft=true` (save as a draft). Bodies must be `application/json` (otherwise `415`), at most 1 MiB (`413`) and a JSON object (`400`).

```sh
curl 'https://example.com/api/collections/posts?where={"status":{"equals":"published"}}&sort=-publishedAt&limit=5'
```

## Auth

The caller is the session user (the Better Auth cookie) or anonymous. Requests go through the same access rules, hooks and validation as the Local API. Nothing in the request can bypass them: REST never accepts `overrideAccess`. Anonymous writes reach the pipeline and the default rules deny them.

Every `POST`, `PATCH` and `DELETE` also needs a same-origin `Origin` header, as a defence against cross-site request forgery. A missing or different origin gets `403`. That means REST writes work from your own site's pages, and not from other origins or server-to-server clients. Use [RPC](./rpc.md) for those.

## Errors

Errors look like this:

```json
{ "error": "Validation failed", "code": "VALIDATION", "errors": [{ "path": "title", "message": "Required" }] }
```

| Status | Meaning |
|---|---|
| 400 | Validation or a bad query. |
| 403 | Forbidden, or a cross-origin write. |
| 404 | Not found. |
| 409 | The document is still referenced. The body has a `references` list. |
| 500 | `{ "error": "Internal error" }`. Details stay in the logs. |

Responses send `cache-control: no-store`.

## Turn it off

If every consumer uses the Local API or RPC, close the surface:

```ts
export default defineConfig({ rest: false, collections: [] });
```

Every `/api/collections/*` and `/api/globals/*` route then returns 404. The admin, upload, media and plugin routes are unaffected.
