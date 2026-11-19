// Content loading for the public routes (server only). Everything goes through `locals.cms`, acting
// as the visitor: anonymous requests only ever see published documents.
import type { PageBlock } from './blocks/types';

type Cms = App.Locals['cms'];

/** The published page with this slug (uploads populated). */
export async function loadPage(cms: Cms, slug: string) {
	const page = await cms.findOne('pages', { where: { slug: { equals: slug } }, depth: 1 });
	if (!page) return null;
	return { page, blocks: (page.sections ?? []) as unknown as PageBlock[] };
}
