// SPIKE (Phase 0, benchmarks): page-read benchmark. D1 time (round trips) vs JSON parse vs total.
// NOTE: in a deployed Worker, performance.now() only advances on I/O, so CPU-only work
// (JSON.parse, Drizzle row mapping) reads as ~0 here. D1 round trips are measured correctly.
import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import config from '../../../kitcms.config.ts';
import { buildTables, type AnyTable } from '../../../../kitcms-spike/drizzle-runtime.ts';
import { toTableSpecs } from '../../../../kitcms-spike/schema-spec.ts';
import { benchId, benchMediaIds, makeSections } from '../../../../kitcms-spike/bench-payload.ts';
import type { RequestHandler } from './$types';

const tables = buildTables(toTableSpecs(config));
const media = tables.media as AnyTable;
const pages = tables.pages as AnyTable;

type Meta = Record<string, unknown>;
type Series = Record<string, number[]>;

function stats(xs: number[]) {
	const s = [...xs].sort((a, b) => a - b);
	const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
	const r = (n: number) => Math.round(n * 100) / 100;
	return { min: r(s[0]!), median: r(q(0.5)), p95: r(q(0.95)), n: s.length };
}

async function seed(blocks: number, reseed: boolean) {
	const db = drizzle(env.DB);
	const slug = `bench-${blocks}`;
	const ids = benchMediaIds(blocks);
	const now = new Date();
	if (reseed) {
		await db.batch([
			db.delete(pages).where(eq(pages.slug, slug)),
			db.delete(media).where(inArray(media.id, ids)),
		]);
	}
	const mediaRows = ids.map((id, i) => ({
		id,
		createdAt: now,
		updatedAt: now,
		filename: `bench-${i}.jpg`,
		key: `media/bench/${id}.jpg`,
		mimeType: 'image/jpeg',
		alt: `Bench image ${i}`,
	}));
	const sections = makeSections(blocks, ids);
	await db.batch([
		db.insert(media).values(mediaRows).onConflictDoNothing(),
		db
			.insert(pages)
			.values({
				id: benchId('P', blocks),
				createdAt: now,
				updatedAt: now,
				_status: 'published',
				_order: 'a0',
				title: `Bench ${blocks}`,
				slug,
				views: 0,
				featured: false,
				template: 'resort',
				publishedAt: now,
				cover: ids[0],
				parent: null,
				seo: { metaTitle: 'Bench' },
				sections,
			})
			.onConflictDoNothing(),
	]);
	return { slug, ids };
}

export const GET: RequestHandler = async ({ url }) => {
	const blocks = Number(url.searchParams.get('blocks') ?? 15);
	const iterations = Number(url.searchParams.get('iterations') ?? 20);
	const mode = url.searchParams.get('mode') ?? 'both';
	if (!Number.isInteger(blocks) || blocks < 1 || blocks > 100) error(400, 'blocks must be 1..100');
	if (!Number.isInteger(iterations) || iterations < 1 || iterations > 200)
		error(400, 'iterations must be 1..200');
	if (!['raw', 'drizzle', 'both'].includes(mode)) error(400, 'mode must be raw|drizzle|both');

	const { slug, ids } = await seed(blocks, url.searchParams.get('reseed') === '1');
	const db = drizzle(env.DB);
	const placeholders = ids.map(() => '?').join(',');
	const pageSql = 'select * from pages where slug = ?';
	const mediaSql = `select * from media where id in (${placeholders})`;
	const metas: Record<string, Meta> = {};
	const pick = (label: string, m: Meta | undefined) => {
		if (!m) return;
		metas[label] = {
			duration: m.duration,
			served_by_region: m.served_by_region,
			served_by_primary: m.served_by_primary,
			served_by: m.served_by,
		};
	};
	const ms = async <T>(fn: () => Promise<T>): Promise<[number, T]> => {
		const t0 = performance.now();
		const r = await fn();
		return [performance.now() - t0, r];
	};

	const out: Record<string, unknown> = {
		blocks,
		iterations,
		slug,
		mediaIds: ids.length,
		timerNote:
			'performance.now() only advances on I/O in deployed Workers: parse/row-mapping read ~0 there.',
	};
	const row = await env.DB.prepare(pageSql).bind(slug).first<{ sections: string }>();
	out.sectionsBytes = new TextEncoder().encode(row?.sections ?? '').length;

	if (mode !== 'drizzle') {
		const s: Series = { page: [], media: [], sequentialTotal: [], batch: [], parse: [] };
		for (let i = 0; i < iterations; i++) {
			const [tTotal] = await ms(async () => {
				const [a, r] = await ms(() =>
					env.DB.prepare(pageSql).bind(slug).first<{ sections: string }>(),
				);
				s.page!.push(a);
				const [b, m] = await ms(() =>
					env.DB.prepare(mediaSql)
						.bind(...ids)
						.all(),
				);
				s.media!.push(b);
				if (i === iterations - 1) pick('raw.media', m.meta);
				const [p] = await ms(async () => JSON.parse(r!.sections));
				s.parse!.push(p);
			});
			s.sequentialTotal!.push(tTotal);
			const [tb, br] = await ms(() =>
				env.DB.batch([env.DB.prepare(pageSql).bind(slug), env.DB.prepare(mediaSql).bind(...ids)]),
			);
			s.batch!.push(tb);
			if (i === iterations - 1) pick('raw.batch[0]', br[0]?.meta);
		}
		out.raw = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, stats(v)]));
	}

	if (mode !== 'raw') {
		const s: Series = { page: [], media: [], sequentialTotal: [], batch: [] };
		for (let i = 0; i < iterations; i++) {
			const [tTotal] = await ms(async () => {
				const [a] = await ms(() => db.select().from(pages).where(eq(pages.slug, slug)).get());
				s.page!.push(a);
				const [b] = await ms(() => db.select().from(media).where(inArray(media.id, ids)).all());
				s.media!.push(b);
			});
			s.sequentialTotal!.push(tTotal);
			const [tb] = await ms(() =>
				db.batch([
					db.select().from(pages).where(eq(pages.slug, slug)),
					db.select().from(media).where(inArray(media.id, ids)),
				]),
			);
			s.batch!.push(tb);
		}
		out.drizzle = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, stats(v)]));
	}
	out.d1Meta = metas;
	return Response.json(out);
};
