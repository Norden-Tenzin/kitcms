import type { CollectionDef, Config, FieldDef, GlobalDef, KitcmsPlugin, PluginHandleArgs } from '@kitcms/core';
import { fields } from '@kitcms/core';
import { baseFrom, normalizePath } from './paths';
import { createRedirectCache, locationFor, redirectsCollection, type RedirectsOptions } from './redirects';
import {
	collectEntries,
	renderRobots,
	renderSitemap,
	type RobotsOptions,
	type SitemapOptions,
} from './sitemap';

export interface SeoOptions {
	/** Collection slugs to add the meta group to. */
	collections?: string[];
	/** Global slugs to add the meta group to. */
	globals?: string[];
	/** Upload collection for `meta.image`. Omit for no image field. */
	uploadsCollection?: string;
	/** Name of the group field. Default `'meta'`. */
	fieldName?: string;
	/** Recommended title length, shown as a hint only. Default 60. */
	titleMaxLength?: number;
	/** Recommended description length, shown as a hint only. Default 160. */
	descriptionMaxLength?: number;
	/**
	 * Editor-managed redirects, applied before the site renders. Adds a `redirects` collection
	 * (signed-in access) and a cache per isolate: edits show up in this isolate at once and in
	 * others within `cacheTtl` seconds (default 60). `/`-relative targets get the app's base path.
	 */
	redirects?: boolean | RedirectsOptions;
	/** `/sitemap.xml` from published docs. */
	sitemap?: SitemapOptions;
	/**
	 * `/robots.txt`. `true` = `Disallow: /admin` and `/api`, plus a `Sitemap:` line when `sitemap` is
	 * set. A static `robots.txt` in the app's assets wins (Cloudflare serves assets before the Worker).
	 */
	robots?: boolean | RobotsOptions;
}

export type { RedirectsOptions, RobotsOptions, SitemapOptions };

const fail = (msg: string): never => {
	throw new Error(`seo: ${msg}`);
};

/** Adds an SEO `meta` group (title, description, image, noIndex) to the listed collections and globals. */
export function seo(options: SeoOptions = {}): KitcmsPlugin {
	const fieldName = options.fieldName ?? 'meta';
	const titleLen = options.titleMaxLength ?? 60;
	const descLen = options.descriptionMaxLength ?? 160;

	const redirects = options.redirects ? (typeof options.redirects === 'object' ? options.redirects : {}) : null;
	const redirectsSlug = redirects?.collection ?? 'redirects';
	const cacheTtl = redirects?.cacheTtl ?? 60;
	if (redirects && !(cacheTtl >= 0)) fail('redirects.cacheTtl must be a number of seconds.');
	const cache = redirects ? createRedirectCache(redirectsSlug, cacheTtl) : null;
	const robots = options.robots ? (typeof options.robots === 'object' ? options.robots : {}) : null;
	const sitemap = options.sitemap ?? null;

	if (sitemap) {
		if (!sitemap.collections || typeof sitemap.collections !== 'object') fail('sitemap.collections is required.');
		for (const [slug, b] of Object.entries(sitemap.collections)) {
			if (typeof b === 'string' && !b.startsWith('/')) fail(`sitemap pattern for "${slug}" must start with "/".`);
		}
		for (const p of sitemap.paths ?? []) if (!p.startsWith('/')) fail(`sitemap path "${p}" must start with "/".`);
		if (sitemap.origin !== undefined) {
			let ok = false;
			try {
				ok = /^https?:$/.test(new URL(sitemap.origin).protocol);
			} catch {
				/* invalid */
			}
			if (!ok) fail(`sitemap.origin "${sitemap.origin}" must be an http(s) origin like https://example.com.`);
		}
	}
	const sitemapOrigin = sitemap?.origin ? new URL(sitemap.origin).origin : null;

	const handle: KitcmsPlugin['handle'] =
		redirects || sitemap || robots
			? async ({ event, path, cms }: PluginHandleArgs) => {
					const method = event.request.method;
					if (method !== 'GET' && method !== 'HEAD') return;
					const base = baseFrom(event.url.pathname, path);
					const origin = sitemapOrigin ?? event.url.origin;
					if (sitemap && path === '/sitemap.xml') {
						const entries = await collectEntries(sitemap, cms, origin, base, fieldName);
						return new Response(renderSitemap(entries), {
							headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' },
						});
					}
					if (robots && path === '/robots.txt') {
						const sitemapUrl = sitemap ? `${origin}${base}/sitemap.xml` : null;
						return new Response(renderRobots(robots, sitemapUrl), {
							headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' },
						});
					}
					if (cache) {
						const target = (await cache.get(cms)).get(normalizePath(path));
						if (!target) return;
						const location = locationFor(target, event.url, base);
						if (location) return new Response(null, { status: target.status, headers: { location } });
					}
				}
			: undefined;

	return {
		name: 'seo',
		...(handle ? { handle } : {}),
		config(config: Config): Config {
			const collections = (config.collections ?? []) as readonly CollectionDef[];
			const globals = (config.globals ?? []) as readonly GlobalDef[];

			if (options.uploadsCollection !== undefined) {
				const up = collections.find((c) => c.slug === options.uploadsCollection);
				if (!up) fail(`uploadsCollection "${options.uploadsCollection}" does not exist.`);
				else if (!up.upload) fail(`uploadsCollection "${options.uploadsCollection}" is not an upload collection.`);
			}

			let withRedirects = collections;
			if (redirects) {
				if (collections.some((c) => c.slug === redirectsSlug)) fail(`collection "${redirectsSlug}" already exists.`);
				withRedirects = [...collections, redirectsCollection(redirectsSlug, () => cache!.invalidate())];
			}
			if (sitemap) {
				for (const slug of Object.keys(sitemap.collections)) {
					if (!withRedirects.some((c) => c.slug === slug)) fail(`sitemap collection "${slug}" does not exist.`);
				}
			}

			const group = (): FieldDef =>
				fields.group({
					admin: { position: 'sidebar', description: 'Search engine and social sharing.' },
					fields: {
						title: fields.text({
							admin: { description: `Recommended: up to ${titleLen} characters. Falls back to the page title.` },
						}),
						description: fields.textarea({
							admin: { description: `Recommended: up to ${descLen} characters.` },
						}),
						...(options.uploadsCollection !== undefined
							? {
									image: fields.upload({
										relationTo: options.uploadsCollection,
										admin: { description: 'Shown when the page is shared. 1200x630 works best.' },
									}),
								}
							: {}),
						noIndex: fields.checkbox({
							defaultValue: false,
							admin: { description: 'Ask search engines not to list this page.' },
						}),
					},
				}) as FieldDef;

			const apply = <T extends { slug: string; fields: Record<string, FieldDef> }>(
				items: readonly T[],
				slugs: string[] | undefined,
				kind: string,
			): readonly T[] => {
				if (!slugs?.length) return items;
				for (const s of slugs) if (!items.some((i) => i.slug === s)) fail(`${kind} "${s}" does not exist.`);
				return items.map((item) => {
					if (!slugs.includes(item.slug)) return item;
					if (fieldName in item.fields) fail(`${kind} "${item.slug}" already has a field named "${fieldName}".`);
					return { ...item, fields: { ...item.fields, [fieldName]: group() } };
				});
			};

			return {
				...config,
				...(config.collections || options.collections?.length || redirects
					? { collections: apply(withRedirects, options.collections, 'collection') as CollectionDef[] }
					: {}),
				...(config.globals || options.globals?.length
					? { globals: apply(globals, options.globals, 'global') as GlobalDef[] }
					: {}),
			};
		},
	};
}
