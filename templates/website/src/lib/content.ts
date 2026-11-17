// Content loading for the public routes (server only). Everything goes through `locals.cms`, acting
// as the visitor: anonymous requests only ever see published documents.
import type { BlockExtras, PageBlock } from './blocks/types';

type Cms = App.Locals['cms'];

/** The published page with this slug (uploads populated), plus the data its blocks render. */
export async function loadPage(cms: Cms, slug: string) {
	const page = await cms.findOne('pages', { where: { slug: { equals: slug } }, depth: 1 });
	if (!page) return null;

	const blocks = (page.sections ?? []) as unknown as PageBlock[];
	const postCount = Math.max(
		0,
		...blocks.flatMap((b) => (b.blockType === 'latestPosts' ? [b.count ?? 3] : [])),
	);
	const [team, posts] = await Promise.all([
		blocks.some((b) => b.blockType === 'teamGrid')
			? cms.find('team', { depth: 1, limit: 100, pagination: false })
			: null,
		postCount > 0
			? cms.find('posts', { depth: 1, limit: postCount, sort: '-publishedAt', pagination: false })
			: null,
	]);
	const extras: BlockExtras = {
		team: team?.docs,
		// `slug` is filled from the title on save; the check only narrows its type.
		posts: posts?.docs.flatMap((d) => (d.slug ? [{ ...d, slug: d.slug }] : [])),
	};
	return { page, blocks, extras };
}
