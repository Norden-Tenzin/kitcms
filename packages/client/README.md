# @kitcms/client

A small typed client for Workers that read kitcms content over a Service Binding. It calls the `KitcmsRPC` entrypoint of a kitcms Worker and has no runtime dependencies, so it works in Workers. Use it for headless setups, where the CMS runs in one Worker and the site or other services run in another.

```sh
pnpm add @kitcms/client
```

## Setup

1. Bind the consumer Worker to the CMS Worker's `KitcmsRPC` entrypoint (`wrangler.jsonc`):

   ```jsonc
   {
   	"services": [{ "binding": "CMS", "service": "kitcms-dev", "entrypoint": "KitcmsRPC" }],
   }
   ```

2. Generate the document types from the CMS app's config. The default output is `kitcms-types.d.ts`:

   ```sh
   kitcms generate:types --out ../consumer/src/kitcms-types.d.ts
   ```

3. Call the CMS from the consumer Worker (from `apps/dev-consumer/src/index.ts`):

   ```ts
   import { kitcms, isKitcmsClientError, type KitcmsBinding } from '@kitcms/client';
   import type { KitcmsTypes } from './kitcms-types';

   interface Env {
   	CMS: Service & KitcmsBinding;
   }

   export default {
   	async fetch(req, env): Promise<Response> {
   		const cms = kitcms<KitcmsTypes>(env.CMS);
   		// Anonymous: only published pages (the collection's read rule).
   		const { docs, totalDocs } = await cms.find('pages', {
   			sort: '-updatedAt',
   			depth: 1,
   			limit: 10,
   		});
   		return Response.json({ totalDocs, titles: docs.map((p) => p.title) });
   	},
   } satisfies ExportedHandler<Env>;
   ```

   Errors arrive as `KitcmsClientError`, with the CMS error `code` and `status`:

   ```ts
   try {
   	await cms.count('users');
   } catch (err) {
   	if (isKitcmsClientError(err)) console.log(err.code, err.status);
   }
   ```

## Trusted calls

`{ as: 'system' }` skips the collection and field access rules. Hooks and validation still run. Use it only from Workers you control:

```ts
const all = await cms.find('pages', { as: 'system', limit: 50 });
const draft = await cms.findByID('pages', id, { as: 'system', draft: true }); // drafts: system only
```

Writes are **system-only**. Without `{ as: 'system' }` they fail with `FORBIDDEN` before doing anything:

```ts
const page = await cms.create('pages', { title: 'Hello' }, { as: 'system' });
await cms.update('pages', page.id, { title: 'Hi' }, { as: 'system', draft: true });
await cms.move('pages', page.id, { after: otherId }, { as: 'system' }); // orderable collections
await cms.unpublish('pages', page.id, { as: 'system' });
await cms.delete('pages', page.id, { as: 'system' });
await cms.updateGlobal('site', { siteName: 'Dzongla' }, { as: 'system' });
```

## Notes

- Reads: `find`, `findOne`, `findByID`, `count`, `findGlobal`, `getMediaUrl` (anonymous by default). Writes: `create`, `update`, `delete`, `move`, `unpublish`, `updateGlobal` (system only).
- Under `vite dev`, the CMS RPC entrypoint is not served, and a running dev server shadows it for consumers. To test a consumer, run the CMS with `pnpm preview` (`wrangler dev`).
- Set `media.publicUrl` in the CMS config. Without it, media URLs are relative (`/api/media/...`), which a headless consumer can't use.

Status: pre-release (0.x), Cloudflare Workers + D1 + R2 only.
