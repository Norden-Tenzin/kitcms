---
title: Generated types
description: Generate document types for consumers that do not have your config, with kitcms generate:types.
order: 5
---

This page explains how types reach your code, in the app and in headless consumers.

## In the app

In a full app you do not generate anything. `defineConfig()` computes the document types, and you register the config in `src/app.d.ts`:

```ts title="src/app.d.ts"
import type config from './kitcms.config';

declare module '@kitcms/core' {
	interface Register {
		config: typeof config;
	}
}
```

After that, `locals.cms` and the types `DocOf` and `InputOf` follow your config.

## For other Workers

A consumer Worker has no `kitcms.config.ts`. `kitcms generate:types` writes a `.d.ts` file with a type for every collection and global, plus the input shapes for writes:

```sh
pnpm exec kitcms generate:types                                    # writes kitcms-types.d.ts
pnpm exec kitcms generate:types --out ../consumer/src/kitcms-types.d.ts
```

In the template, `pnpm types` runs it. Regenerate the file whenever you change the config, then commit the copy in the consumer.

The file exports a `KitcmsTypes` interface. Pass it to the client:

```ts
import { kitcms } from '@kitcms/client';
import type { KitcmsTypes } from './kitcms-types';

const cms = kitcms<KitcmsTypes>(env.CMS);
const { docs } = await cms.find('posts', { depth: 1 });
```

Relationship fields are branded IDs. With `depth: 1` or `2`, the client's result type replaces them with the target documents, as in the Local API.

Rich text values use the `RichTextDoc` type, which the file declares for you.

## Fields that plugins add

Fields added by a plugin are in the generated types, because the file is built from the sanitized config. In the app, plugin fields are not part of the inferred `DocOf` types. Use the generated types, or cast the value, for example `Parameters<typeof getMeta>[0]` for the SEO plugin's `meta` group.
