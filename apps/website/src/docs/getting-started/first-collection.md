---
title: Your first collection
description: Add a collection to the schema, migrate the database and read it from a route.
order: 5
---

This page adds a `posts` collection, creates its table and shows its documents on a page.

## 1. Define it

Add a collection to `src/kitcms.config.ts`:

```ts title="src/kitcms.config.ts"
import { collection, defineConfig, fields as f } from '@kitcms/core';

export default defineConfig({
	admin: { title: 'My site' },
	collections: [
		collection({
			slug: 'posts',
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'publishedAt'] },
			defaultSort: '-publishedAt',
			// Without a read rule, only signed-in users can read.
			access: { read: () => true },
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				publishedAt: f.date({ admin: { position: 'sidebar' } }),
				body: f.textarea(),
			},
		}),
	],
});
```

`collection()` and `defineConfig()` return what you pass in. Their job is typing: the document type of `posts` is computed once from these fields.

New collections are private by default. Without `access.read`, anonymous visitors get nothing. `read: () => true` makes the collection public.

## 2. Migrate

The schema is code, so the database follows it through migrations. Generate one and apply it to the local D1:

```sh
pnpm db:generate add-posts
pnpm db:migrate
```

Read the generated SQL in `migrations/` before you apply it. A renamed field appears as a drop and an add, which loses data.

## 3. Add content

Run `pnpm dev`, open `/admin` and create a post.

## 4. Read it

`locals.cms` is the Local API acting as the visitor. Use it in a server load function:

```ts title="src/routes/blog/+page.server.ts"
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { docs } = await locals.cms.find('posts', { limit: 20 });
	return { posts: docs };
};
```

Collection names, field names and results are typed from your config. A typo in `'posts'` is a type error.

## Next

- [Fields](../configuration/fields.md): every field type and its options.
- [The Local API](../content/local-api.md): `find`, `where`, `sort`, `depth` and writes.
- [Deploy in 5 minutes](./deploy-in-5-minutes.md).
