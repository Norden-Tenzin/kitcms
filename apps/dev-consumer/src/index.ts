// A headless consumer: reads kitcms content over the Service Binding with the typed client.
import { kitcms, isKitcmsClientError, type KitcmsBinding } from '@kitcms/client';
import type { KitcmsTypes } from './kitcms-types';

interface Env {
	CMS: Service & KitcmsBinding;
	SITE: Fetcher;
}

export default {
	async fetch(req, env): Promise<Response> {
		const url = new URL(req.url);
		const cms = kitcms<KitcmsTypes>(env.CMS);

		if (url.pathname === '/system') {
			// Trusted caller: sees drafts too.
			const all = await cms.find('pages', { as: 'system', limit: 50 });
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
