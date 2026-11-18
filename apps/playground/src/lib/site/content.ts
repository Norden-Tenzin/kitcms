// Content loading for the public routes (server only). Everything goes through `locals.cms` acting as
// the visitor: anonymous requests only see published documents.
import { ForbiddenError } from '@kitcms/core';
import { resolveDesign, type PageType } from './designs';
import type { BlockExtras, BlockType, Page, PageBlock, Site } from './types';

type Cms = App.Locals['cms'];

/** A denied read (an add-on that is off) becomes `null`; any other error still surfaces. */
const forbiddenAsNull = (err: unknown): null => {
	if (err instanceof ForbiddenError) return null;
	throw err;
};

/** Site settings (depth 1: logo and nav pages) and the legal pages, for every public page. */
export async function loadShell(cms: Cms) {
	const [site, legal] = await Promise.all([
		cms.findGlobal('site', { depth: 1 }),
		cms.find('legal', { sort: 'title', limit: 20, pagination: false }),
	]);
	return {
		site: site as unknown as Site,
		legal: legal.docs.flatMap((d) => (d.slug ? [{ title: d.title, slug: d.slug }] : [])),
	};
}

/** The design for a page type, from the document's override and the site's Design tab. */
export const designFor = (type: PageType, site: Site, override?: string | null) =>
	resolveDesign(type, site.design as Partial<Record<string, string | null>> | undefined, override);

/**
 * The data the blocks of a page need: only what its block types use. Part 2's list pages can call the
 * same loaders directly (`cms.find('projects', ...)`); this is for pages built from blocks.
 */
export async function loadBlockExtras(cms: Cms, blocks: PageBlock[]): Promise<BlockExtras> {
	const of = (t: BlockType) => blocks.filter((b) => b.blockType === t);
	const has = (t: BlockType) => of(t).length > 0;
	const maxOf = (t: BlockType, fallback: number) =>
		Math.max(fallback, ...of(t).map((b) => Number((b as { count?: number }).count ?? fallback)));

	const [services, projects, testimonials, team, posts, offers] = await Promise.all([
		has('servicesList') ? cms.find('services', { depth: 1, limit: 12, pagination: false }) : null,
		has('projectsList') ? cms.find('projects', { depth: 1, limit: 24, pagination: false, sort: '-year' }) : null,
		has('testimonials') ? cms.find('testimonials', { limit: maxOf('testimonials', 3), pagination: false }) : null,
		has('teamGrid') ? cms.find('team', { depth: 1, limit: 50, pagination: false }) : null,
		has('latestPosts')
			? cms.find('posts', { depth: 1, limit: maxOf('latestPosts', 3), sort: '-publishedAt', pagination: false })
			: null,
		// `offers` sits behind the `offers` add-on: with it off the read is denied and the block renders nothing.
		has('offers') ? cms.find('offers', { limit: 12, pagination: false }).catch(forbiddenAsNull) : undefined,
	]);
	return {
		services: services?.docs as unknown as BlockExtras['services'],
		projects: projects?.docs as unknown as BlockExtras['projects'],
		testimonials: testimonials?.docs as unknown as BlockExtras['testimonials'],
		team: team?.docs as unknown as BlockExtras['team'],
		posts: posts?.docs as unknown as BlockExtras['posts'],
		offers: offers === undefined ? undefined : ((offers?.docs as unknown as BlockExtras['offers']) ?? null),
	};
}

/** The published page with this slug (uploads populated), plus the data its blocks render. */
export async function loadPage(cms: Cms, slug: string) {
	const found = await cms.findOne('pages', { where: { slug: { equals: slug } }, depth: 1 });
	if (!found) return null;
	const page = found as unknown as Page;
	const blocks = (page.sections ?? []) as PageBlock[];
	return { page, blocks, extras: await loadBlockExtras(cms, blocks) };
}
