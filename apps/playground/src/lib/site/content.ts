// Content loading for the public routes (server only). Everything goes through `locals.cms` acting
// as the visitor: anonymous requests only see published documents.
import { resolveDesign, type PageType } from './designs';
import type { BlockExtras, Page, PageBlock, Room, Site } from './types';

type Cms = App.Locals['cms'];

/** Site settings (depth 1: logo + nav pages) and the legal pages, for every public page. */
export async function loadShell(cms: Cms) {
	const [site, legal] = await Promise.all([
		cms.findGlobal('site', { depth: 1 }),
		cms.find('legal', { sort: 'title', limit: 20, pagination: false }),
	]);
	return { site: site as unknown as Site, legal: legal.docs.flatMap((d) => (d.slug ? [{ title: d.title, slug: d.slug }] : [])) };
}

/** The design for a page type, from its override and the site's Design tab. */
export const designFor = (type: PageType, site: Site, override?: string | null) =>
	resolveDesign(type, site.design as Partial<Record<string, string | null>> | undefined, override);

/** The data the blocks of a page need (only what its block types use). */
export async function loadBlockExtras(cms: Cms, blocks: PageBlock[]): Promise<BlockExtras> {
	const has = (t: PageBlock['blockType']) => blocks.some((b) => b.blockType === t);
	const [rooms, experiences, testimonials, faqs, offers, albums] = await Promise.all([
		has('roomsList') ? cms.find('rooms', { depth: 1, limit: 24, pagination: false }) : null,
		has('experiencesList') ? cms.find('experiences', { depth: 1, limit: 24, pagination: false }) : null,
		has('testimonials') ? cms.find('testimonials', { limit: 24, pagination: false }) : null,
		has('faq') ? cms.find('faqs', { limit: 60, pagination: false }) : null,
		has('offers') ? cms.find('offers', { depth: 1, limit: 12, pagination: false }) : null,
		has('gallery') ? cms.find('albums', { depth: 1, limit: 12, pagination: false }) : null,
	]);
	return {
		rooms: rooms?.docs as unknown as Room[] | undefined,
		experiences: experiences?.docs as unknown as BlockExtras['experiences'],
		testimonials: testimonials?.docs as unknown as BlockExtras['testimonials'],
		faqs: faqs?.docs as unknown as BlockExtras['faqs'],
		offers: offers?.docs as unknown as BlockExtras['offers'],
		albums: albums?.docs as unknown as BlockExtras['albums'],
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
