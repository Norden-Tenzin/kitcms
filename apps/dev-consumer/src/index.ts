// A headless consumer: reads kitcms content over the Service Binding with the typed client.
import { kitcms, isKitcmsClientError, type KitcmsBinding } from '@kitcms/client';
import type { KitcmsTypes } from './kitcms-types';

interface Env {
	CMS: Service & KitcmsBinding;
	SITE: Fetcher;
	/** Set (`--var E2E:1`) by the e2e run only: enables the generic `/e2e/call` proxy below. */
	E2E?: string;
}

export default {
	async fetch(req, env): Promise<Response> {
		const url = new URL(req.url);
		const cms = kitcms<KitcmsTypes>(env.CMS);

		// e2e contract tests (e2e/tests/rpc.spec.ts): POST { method, args } calls the typed client and
		// returns the result, or the parsed error. Off unless the `E2E` var is set.
		if (url.pathname === '/e2e/call' && req.method === 'POST' && env.E2E === '1') {
			const { method, args } = (await req.json()) as { method: string; args: unknown[] };
			const fn = (cms as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method];
			if (typeof fn !== 'function') return Response.json({ ok: false, error: 'unknown method' }, { status: 400 });
			try {
				return Response.json({ ok: true, result: (await fn.apply(cms, args)) ?? null });
			} catch (err) {
				return Response.json(
					isKitcmsClientError(err)
						? { ok: false, clientError: true, code: err.code, status: err.status, message: err.message, name: err.name }
						: { ok: false, clientError: false, message: String(err) },
				);
			}
		}

		if (url.pathname === '/phase2') return Response.json(await phase2(cms));
		if (url.pathname === '/system') {
			// Trusted caller: skips access rules; `draft: true` would include unpublished drafts.
			const all = await cms.find('pages', { as: 'system', limit: 50, draft: true });
			return Response.json({ totalDocs: all.totalDocs, titles: all.docs.map((p) => p.title) });
		}
		if (url.pathname === '/error') {
			try {
				await cms.find('pages', { where: { nope: { equals: 1 } } } as never);
				return Response.json({ ok: false });
			} catch (err) {
				return Response.json(isKitcmsClientError(err) ? { code: err.code, status: err.status } : String(err));
			}
		}
		// Anonymous: only published pages (the collection's read rule).
		const { docs, totalDocs } = await cms.find('pages', { sort: '-updatedAt', depth: 1, limit: 10 });
		const page = docs[0];
		const users = await cms.count('users').catch((err: unknown) =>
			isKitcmsClientError(err) ? `denied (${err.status})` : 'error',
		);
		const site = await env.SITE.fetch('http://cms/');
		return Response.json({
			siteStatus: site.status,
			totalDocs,
			first: page && { title: page.title, slug: page.slug, sections: page.sections.length },
			anonymousUserCount: users,
		});
	},
} satisfies ExportedHandler<Env>;

type Client = ReturnType<typeof kitcms<KitcmsTypes>>;

async function codeOf(p: Promise<unknown>): Promise<string> {
	try {
		await p;
		return 'ok';
	} catch (err) {
		return isKitcmsClientError(err) ? err.code : String(err);
	}
}

/** Phase 2 RPC checks (§13.8): system-only writes, system-only drafts, globals. Cleans up after itself. */
async function phase2(cms: Client) {
	const out: Record<string, unknown> = {};
	out.anonymousCreate = await codeOf(cms.create('pages', { title: 'x' }, {} as never));
	const slug = `rpc-check-${Date.now()}`;
	const draft = await cms.create('pages', { title: 'RPC check', slug }, { as: 'system', draft: true });
	out.anonymousSeesDraft = (await cms.findByID('pages', draft.id)) !== null;
	out.anonymousDraftRead = await codeOf(cms.findByID('pages', draft.id, { draft: true } as never));
	out.systemSeesDraft = (await cms.findByID('pages', draft.id, { as: 'system', draft: true }))?.title ?? null;
	await cms.update('pages', draft.id, { title: 'RPC check (published)' }, { as: 'system' });
	out.anonymousSeesPublished = (await cms.findByID('pages', draft.id))?.title ?? null;
	await cms.unpublish('pages', draft.id, { as: 'system' });
	out.anonymousAfterUnpublish = (await cms.findByID('pages', draft.id)) !== null;
	await cms.delete('pages', draft.id, { as: 'system' });
	out.site = await cms.findGlobal('site');
	return out;
}
