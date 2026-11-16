// SPIKE (Phase 0): a stand-in Local API for the admin-mount spike, built on the data-layer spike.
// Phase 1 replaces this with @kitcms/core's real pipeline (access → hooks → validate → D1 → hooks).
import { env } from 'cloudflare:workers';
import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Doc, KitcmsLocal } from '@kitcms/core/sveltekit';
import config from '../../kitcms.config.ts';
import { buildTables } from '../../../kitcms-spike/drizzle-runtime.ts';
import { toTableSpecs } from '../../../kitcms-spike/schema-spec.ts';

const tables = buildTables(toTableSpecs(config));

const collections = config.collections.map((c) => {
	const editable = Object.entries(c.fields)
		.filter(([, f]) => f.type === 'text')
		.map(([name]) => name);
	return { slug: c.slug, editable, useAsTitle: editable[0] ?? 'id' };
});

function table(slug: string) {
	const t = tables[slug];
	if (!t || !collections.some((c) => c.slug === slug))
		throw new Error(`Unknown collection ${slug}`);
	return t;
}

export function createSpikeCms(): KitcmsLocal {
	const db = drizzle(env.DB);
	return {
		collections,
		async find(slug, opts) {
			const t = table(slug);
			const docs = await db
				.select()
				.from(t)
				.orderBy(desc(t.updatedAt))
				.limit(opts?.limit ?? 10)
				.all();
			return { docs: docs as Doc[] };
		},
		async findByID(slug, id) {
			const t = table(slug);
			return ((await db.select().from(t).where(eq(t.id, id)).get()) as Doc | undefined) ?? null;
		},
		async update(slug, id, data) {
			const t = table(slug);
			const [doc] = await db
				.update(t)
				.set({ ...data, updatedAt: new Date() })
				.where(eq(t.id, id))
				.returning();
			if (!doc) throw new Error('Not found');
			return doc as Doc;
		},
	};
}
