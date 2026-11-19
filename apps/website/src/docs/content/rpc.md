---
title: Headless over RPC
description: Read and write content from other Workers through a Service Binding and the typed @kitcms/client.
order: 4
---

This page shows how to expose your kitcms app to other Workers and call it with `@kitcms/client`.

In a headless setup, kitcms runs in one Worker (the admin, D1, R2) and your site or other services run in other Workers. They call kitcms over a **Service Binding**: a direct Worker-to-Worker call inside Cloudflare, with no public URL and no HTTP round trip through the internet.

## 1. Expose the entrypoint

The scaffold already has `src/kitcms.rpc.ts`:

```ts title="src/kitcms.rpc.ts"
import { createKitcmsRPC } from '@kitcms/core/rpc';
import config from './kitcms.config';

export class KitcmsRPC extends createKitcmsRPC(config) {}
```

The kitcms Vite plugin and adapter add this module to the same Worker, so there is no separate RPC Worker to deploy. It must stay a class declaration.

## 2. Bind from the consumer

In the consumer Worker's `wrangler.jsonc`:

```jsonc title="wrangler.jsonc"
{
	"services": [{ "binding": "CMS", "service": "my-kitcms", "entrypoint": "KitcmsRPC" }]
}
```

`service` is the CMS Worker's name.

## 3. Generate types

Generate document types from the CMS app and copy them into the consumer. The default output is `kitcms-types.d.ts`:

```sh
pnpm exec kitcms generate:types --out ../consumer/src/kitcms-types.d.ts
```

See [Generated types](./types.md).

## 4. Call it

```sh
pnpm add @kitcms/client
```

```ts title="src/index.ts"
import { kitcms, isKitcmsClientError, type KitcmsBinding } from '@kitcms/client';
import type { KitcmsTypes } from './kitcms-types';

interface Env {
	CMS: Service & KitcmsBinding;
}

export default {
	async fetch(req, env): Promise<Response> {
		const cms = kitcms<KitcmsTypes>(env.CMS);
		const { docs, totalDocs } = await cms.find('pages', {
			sort: '-updatedAt',
			depth: 1,
			limit: 10,
		});
		return Response.json({ totalDocs, titles: docs.map((p) => p.title) });
	},
} satisfies ExportedHandler<Env>;
```

The client has no runtime dependencies. It has the same read methods as the Local API: `find`, `findOne`, `findByID`, `count` and `findGlobal`, with the same `where`, `sort`, `limit`, `page`, `depth` and `pagination`. It adds `getMediaUrl(key)`.

## Who the caller is

By default the caller is **anonymous**: it sees exactly what a signed-out visitor sees, with collection read rules, `where` filters and field read access applied.

### Trusted calls

`{ as: 'system' }` skips collection and field access rules. Hooks and validation still run. Use it only from Workers you control.

```ts
const all = await cms.find('pages', { as: 'system', limit: 50 });
const draft = await cms.findByID('pages', id, { as: 'system', draft: true });
```

Drafts are visible to `system` callers only.

### Writes

Writes are **system only**. Without `{ as: 'system' }` they fail with `FORBIDDEN` before doing any work.

```ts
const page = await cms.create('pages', { title: 'Hello' }, { as: 'system' });
await cms.update('pages', page.id, { title: 'Hi' }, { as: 'system', draft: true });
await cms.move('pages', page.id, { after: otherId }, { as: 'system' });
await cms.unpublish('pages', page.id, { as: 'system' });
await cms.delete('pages', page.id, { as: 'system' });
await cms.updateGlobal('site', { siteName: 'Acme' }, { as: 'system' });
```

### Why the options are whitelisted

The server copies only known options from the caller, with type checks. `overrideAccess`, `req`, `context` or anything else a caller sends is never passed to the Local API, and an unknown option is rejected, so a typo cannot silently do the wrong thing.

## Errors

Errors cross the binding as plain errors with the message `kitcms:<CODE>:<status>: <message>`. The client turns them into `KitcmsClientError`, which has `code` and `status`:

```ts
try {
	await cms.count('users');
} catch (err) {
	if (isKitcmsClientError(err)) console.log(err.code, err.status); // FORBIDDEN 403
}
```

## Media URLs

Set `media.publicUrl` in the CMS config. Without it, media URLs are relative (`/api/media/...`), which a separate Worker cannot use. See [Media](../media/index.md).

## Developing a consumer

Under `vite dev`, the CMS Worker's RPC entrypoint is not served, so a consumer cannot reach it. Run the CMS with `pnpm preview` (`wrangler dev`) while you work on the consumer.

## Versions

The consumer's `@kitcms/client` and the CMS Worker's `@kitcms/core` deploy separately. Within a major version, the server accepts every method and option of earlier minors, and the error format does not change. See [Upgrading](../deploy/upgrading.md).
