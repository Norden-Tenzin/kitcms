import { readAll } from './redirects';
import { buildDocPath, xmlEscape, type PathBuilder } from './paths';

export interface SitemapOptions {
	/**
	 * Collections to list and how to build each doc's path, e.g.
	 * `{ pages: (doc) => doc.slug === 'home' ? '/' : `/${doc.slug}`, rooms: '/rooms/:slug' }`.
	 * A string pattern substitutes `:field` with the doc's field (URL-encoded). Return `null` to skip a doc.
	 */
	collections: Record<string, PathBuilder>;
	/** Extra static paths (e.g. `'/rooms'`, `'/journal'`). */
	paths?: string[];
	/** Canonical origin (`https://example.com`). Default: the request's origin. */
	origin?: string;
}

const MAX_PER_COLLECTION = 5000;
const DATE = /^\d{4}-\d{2}-\d{2}/;

interface Entry {
	loc: string;
	lastmod?: string;
}

const isDenied = (err: unknown): boolean => {
	const status = (err as { status?: number } | null)?.status;
	return status === 401 || status === 403;
};

/** Collect sitemap entries as the anonymous visitor. `base` is the app's `paths.base`. */
export async function collectEntries(
	options: SitemapOptions,
	cms: unknown,
	origin: string,
	base: string,
	fieldName: string,
): Promise<Entry[]> {
	const seen = new Set<string>();
	const entries: Entry[] = [];
	const add = (path: string, lastmod?: string): void => {
		const loc = origin + base + path;
		if (seen.has(loc)) return;
		seen.add(loc);
		entries.push(lastmod ? { loc, lastmod } : { loc });
	};

	for (const p of options.paths ?? []) add(p);

	for (const [slug, builder] of Object.entries(options.collections)) {
		let docs: Record<string, unknown>[];
		try {
			// Anonymous: published documents the visitor may read. No `overrideAccess`.
			({ docs } = await readAll(cms, slug, { depth: 0 }, MAX_PER_COLLECTION));
		} catch (err) {
			if (!isDenied(err)) console.warn(`seo: sitemap skipped "${slug}"`, err);
			continue;
		}
		for (const doc of docs) {
			const meta = doc[fieldName];
			if (typeof meta === 'object' && meta !== null && (meta as { noIndex?: unknown }).noIndex === true) continue;
			const path = buildDocPath(builder, doc);
			if (path === null) continue;
			const updated = doc.updatedAt;
			add(path, typeof updated === 'string' && DATE.test(updated) ? updated.slice(0, 10) : undefined);
		}
	}
	return entries;
}

export function renderSitemap(entries: Entry[]): string {
	const urls = entries
		.map(
			(e) =>
				`<url><loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`,
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export interface RobotsOptions {
	/** Extra `Disallow` paths. */
	disallow?: string[];
}

export function renderRobots(options: RobotsOptions, sitemapUrl: string | null): string {
	const lines = ['User-agent: *', 'Disallow: /admin', 'Disallow: /api'];
	for (const d of options.disallow ?? []) lines.push(`Disallow: ${d}`);
	if (sitemapUrl) lines.push('', `Sitemap: ${sitemapUrl}`);
	return lines.join('\n') + '\n';
}
