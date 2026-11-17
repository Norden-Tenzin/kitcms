// Benchmarks (plan §4.10, §11): page-read timings through the REAL Local API vs raw D1.
//   /spike/bench?blocks=10|15|20&iterations=20&reseed=1
//   add &session=1 to also time page reads through D1 sessions (read replication, §13.10):
//   a fresh withSession('first-unconstrained') vs withSession('first-primary') per read, and one
//   session reused for 3 reads (the first read picks the replica, the rest follow the bookmark).
// Disabled unless the Worker var KITCMS_BENCH is "1" (it seeds data). scripts/bench/cold-start.ts
// deploys with it set. NOTE: in a deployed Worker, performance.now() only advances on I/O, so these
// numbers are round-trip times; CPU-only cost comes from `pnpm bench:parse` and `wrangler tail`.
import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { benchMediaIds, makeSections } from '#lib/bench/payload.ts';
import type { RequestHandler } from './$types';

type Series = Record<string, number[]>;

function stats(xs: number[]) {
	const s = [...xs].sort((a, b) => a - b);
	const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
	const r = (n: number) => Math.round(n * 100) / 100;
	return { min: r(s[0]!), median: r(q(0.5)), p95: r(q(0.95)), n: s.length };
}

async function time(series: Series, name: string, fn: () => Promise<unknown>) {
	const t0 = performance.now();
	await fn();
	(series[name] ??= []).push(performance.now() - t0);
}

export const GET: RequestHandler = async ({ url, locals }) => {
	if ((env as unknown as Record<string, unknown>).KITCMS_BENCH !== '1') error(404, 'Not found');
	const blocks = Math.min(Math.max(Number(url.searchParams.get('blocks')) || 10, 1), 40);
	const iterations = Math.min(Math.max(Number(url.searchParams.get('iterations')) || 20, 1), 100);
	const cms = locals.cms;
	const system = { overrideAccess: true } as const;
	const slug = `bench-${blocks}`;

	// Seed (idempotent): media rows, then one bench page whose blocks reference them.
	let page = await cms.findOne('bench', { where: { slug: { equals: slug } }, ...system });
	if (page && url.searchParams.get('reseed') === '1') {
		await cms.delete('bench', page.id, system);
		page = null;
	}
	if (!page) {
		const mediaIds: string[] = [];
		for (const [i] of benchMediaIds(blocks).entries()) {
			const m = await cms.create(
				'media',
				{
					alt: `bench ${blocks}/${i}`,
					filename: `bench-${i}.jpg`,
					mimeType: 'image/jpeg',
					filesize: 1000,
					key: `bench/${blocks}/${i}-${crypto.randomUUID()}.jpg`,
				} as never,
				system,
			);
			mediaIds.push(m.id);
		}
		page = await cms.create('bench', { slug, sections: makeSections(blocks, mediaIds) as never }, system);
	}
	const id = page.id;

	const series: Series = {};
	const withSessions = url.searchParams.get('session') === '1' && typeof env.DB.withSession === 'function';
	for (let i = 0; i < iterations; i++) {
		await time(series, 'raw D1 row', () => env.DB.prepare('select * from bench where id = ?').bind(id).first());
		await time(series, 'Local API findByID depth 0 (1 round trip)', () => cms.findByID('bench', id));
		await time(series, 'Local API findByID depth 1 (2 round trips)', () =>
			cms.findByID('bench', id, { depth: 1 }),
		);
		await time(series, 'Local API find + count (1 round trip)', () => cms.find('bench', { limit: 10 }));
		if (withSessions) {
			const q = (d: { prepare: (sql: string) => D1PreparedStatement }) =>
				d.prepare('select * from bench where id = ?').bind(id).first();
			await time(series, 'session first-unconstrained, 1 read', () => q(env.DB.withSession('first-unconstrained')));
			await time(series, 'session first-primary, 1 read', () => q(env.DB.withSession('first-primary')));
			await time(series, 'session first-unconstrained, 3 reads', async () => {
				const sess = env.DB.withSession('first-unconstrained');
				for (let n = 0; n < 3; n++) await q(sess);
			});
			await time(series, 'session first-primary, 3 reads', async () => {
				const sess = env.DB.withSession('first-primary');
				for (let n = 0; n < 3; n++) await q(sess);
			});
		}
	}

	const sectionsBytes = JSON.stringify(page.sections).length;
	return Response.json({
		blocks,
		iterations,
		sectionsBytes,
		ms: Object.fromEntries(Object.entries(series).map(([k, v]) => [k, stats(v)])),
	});
};
