// SPIKE (Phase 0, data layer): CRUD on D1 through runtime-built Drizzle tables.
import { env } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import config from '../../../kitcms.config.ts';
import { buildTables, type AnyTable } from '../../../../kitcms-spike/drizzle-runtime.ts';
import { toTableSpecs } from '../../../../kitcms-spike/schema-spec.ts';
import { ulid } from '../../../../kitcms-spike/ulid.ts';
import * as generated from '../../../../drizzle/schema.ts';
import type { RequestHandler } from './$types';

const tables = buildTables(toTableSpecs(config));

function shape(t: AnyTable) {
	const c = getTableConfig(t);
	return JSON.stringify({
		name: c.name,
		columns: c.columns.map((col) => [
			col.name,
			col.getSQLType(),
			col.notNull,
			col.primary,
			col.default,
		]),
		indexes: c.indexes.map((i) => [i.config.name, i.config.unique]),
		fks: c.foreignKeys.map((fk) => {
			const r = fk.reference();
			return [r.columns.map((x) => x.name), getTableConfig(r.foreignTable).name, fk.onDelete];
		}),
	});
}

export const GET: RequestHandler = async () => {
	const db = drizzle(env.DB);
	const t = (n: string) =>
		tables[n] ??
		(() => {
			throw new Error(`no table ${n}`);
		})();
	const [media, pages, rels, versions, refs] = [
		'media',
		'pages',
		'pages_rels',
		'pages_versions',
		'_refs',
	].map(t) as [AnyTable, AnyTable, AnyTable, AnyTable, AnyTable];
	const report: Record<string, unknown> = {};
	const time = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
		const t0 = performance.now();
		const r = await fn();
		report[`${label}Ms`] = Math.round(performance.now() - t0);
		return r;
	};

	// 0. Runtime tables must be identical to the generated drizzle-kit schema.
	const genTables = Object.values(generated) as AnyTable[];
	report.runtimeMatchesGenerated =
		genTables.every((g) => {
			const name = getTableConfig(g).name;
			const rt = tables[name];
			return !!rt && shape(rt) === shape(g);
		}) && genTables.length === Object.keys(tables).length;

	// 1. Create: media + page (+ rels, versions, _refs) in one D1 batch.
	const now = new Date();
	const mediaId = ulid();
	const pageId = ulid();
	const relatedId = ulid();
	const slug = `spike-${pageId.slice(-6).toLowerCase()}`;
	const sections = Array.from({ length: 15 }, (_, i) => ({
		id: ulid(),
		blockType: 'hero',
		heading: `Section ${i}`,
		image: mediaId,
	}));
	const pageDoc = {
		id: pageId,
		createdAt: now,
		updatedAt: now,
		_status: 'published',
		_order: 'a0',
		title: 'Spike page',
		slug,
		views: 10,
		featured: true,
		template: 'resort',
		publishedAt: now,
		cover: mediaId,
		parent: null,
		seo: { metaTitle: 'Spike' },
		sections,
	};
	await time('create', () =>
		db.batch([
			db
				.insert(media)
				.values({
					id: mediaId,
					createdAt: now,
					updatedAt: now,
					filename: 'a.jpg',
					key: `media/${mediaId}.jpg`,
					mimeType: 'image/jpeg',
					alt: 'A',
				}),
			db
				.insert(pages)
				.values({
					...pageDoc,
					id: relatedId,
					slug: `${slug}-rel`,
					title: 'Related',
					_order: 'a1',
					sections: [],
					cover: mediaId,
				}),
			db.insert(pages).values(pageDoc),
			db
				.insert(rels)
				.values({
					id: ulid(),
					parentId: pageId,
					path: 'related',
					position: 0,
					toCollection: 'pages',
					toId: relatedId,
				}),
			db
				.insert(versions)
				.values({ id: ulid(), parentId: pageId, snapshot: pageDoc, createdAt: now }),
			db
				.insert(refs)
				.values([
					{
						fromCollection: 'pages',
						fromId: pageId,
						path: 'cover',
						toCollection: 'media',
						toId: mediaId,
					},
					...sections.map((s, i) => ({
						fromCollection: 'pages',
						fromId: pageId,
						path: `sections.${i}.image`,
						toCollection: 'media',
						toId: s.image,
					})),
				]),
		]),
	);

	// 2. Read one page by slug: a single row, JSON columns parsed by Drizzle.
	const page = await time('readOne', () =>
		db.select().from(pages).where(eq(pages.slug, slug)).get(),
	);
	if (!page) throw new Error('page not found after insert');
	report.readTypes = {
		createdAt: page?.createdAt instanceof Date,
		featured: typeof page?.featured,
		sections: Array.isArray(page?.sections) ? page.sections.length : null,
		seo: page?.seo,
	};

	// 3. depth=1: collect media IDs from columns AND inside JSON, then one IN query.
	const ids = new Set<string>([
		page.cover,
		...page.sections.map((s: { image: string }) => s.image),
	]);
	const populated = await time('populate', () =>
		db
			.select()
			.from(media)
			.where(inArray(media.id, [...ids]))
			.all(),
	);
	report.populatedMedia = populated.length;

	// 4. Update: title + sections; rewrite _refs in the same batch.
	const newSections = sections.slice(0, 3);
	await time('update', () =>
		db.batch([
			db
				.update(pages)
				.set({ title: 'Spike page (edited)', sections: newSections, updatedAt: new Date() })
				.where(eq(pages.id, pageId)),
			db.delete(refs).where(and(eq(refs.fromCollection, 'pages'), eq(refs.fromId, pageId))),
			db
				.insert(refs)
				.values(
					newSections.map((s, i) => ({
						fromCollection: 'pages',
						fromId: pageId,
						path: `sections.${i}.image`,
						toCollection: 'media',
						toId: s.image,
					})),
				),
		]),
	);
	report.refsAfterUpdate = (
		await db
			.select({ n: sql<number>`count(*)` })
			.from(refs)
			.where(eq(refs.fromId, pageId))
			.get()
	)?.n;

	// 5. Query: where + sort on real columns.
	const listed = await time('find', () =>
		db
			.select({ id: pages.id, title: pages.title })
			.from(pages)
			.where(and(gt(pages.views, 5), eq(pages._status, 'published')))
			.orderBy(asc(pages._order))
			.limit(10)
			.all(),
	);
	report.findCount = listed.length;

	// 6. Constraints: unique slug, and "used in" lookup through _refs.
	try {
		await db.insert(pages).values({ ...pageDoc, id: ulid() });
		report.uniqueSlugEnforced = false;
	} catch (e) {
		report.uniqueSlugEnforced = String((e as Error).cause ?? e).includes('UNIQUE');
	}
	report.mediaUsedIn = (
		await db
			.select({ n: sql<number>`count(distinct ${refs.fromId})` })
			.from(refs)
			.where(and(eq(refs.toCollection, 'media'), eq(refs.toId, mediaId)))
			.get()
	)?.n;

	// 7. Delete: FK cascade to rels + versions, set-null on cover.
	await time('delete', () =>
		db.batch([
			db.delete(refs).where(eq(refs.fromId, pageId)),
			db.delete(media).where(eq(media.id, mediaId)),
			db.delete(pages).where(eq(pages.id, pageId)),
		]),
	);
	report.cascade = {
		rels: (
			await db
				.select({ n: sql<number>`count(*)` })
				.from(rels)
				.where(eq(rels.parentId, pageId))
				.get()
		)?.n,
		versions: (
			await db
				.select({ n: sql<number>`count(*)` })
				.from(versions)
				.where(eq(versions.parentId, pageId))
				.get()
		)?.n,
		relatedCoverIsNull:
			(await db.select({ cover: pages.cover }).from(pages).where(eq(pages.id, relatedId)).get())
				?.cover === null,
	};
	await db.delete(pages).where(eq(pages.id, relatedId));

	return json(report);
};
