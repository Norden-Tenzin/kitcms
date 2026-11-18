import { error } from '@sveltejs/kit';
import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/devDesign.ts';
import type { Post } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	const { site } = await parent();
	const found = await locals.cms.findOne('posts', { where: { slug: { equals: params.slug } }, depth: 2 });
	if (!found) error(404, 'Post not found');
	const post = found as unknown as Post;
	const all = (await locals.cms.find('posts', { depth: 1, sort: '-publishedAt', limit: 100, pagination: false })).docs as unknown as Post[];
	const tagIds = new Set(
		(post.tags ?? []).map((t) => (typeof t === 'string' ? t : (t as { id?: string }).id)).filter(Boolean),
	);
	const others = all.filter((p) => p.id !== post.id);
	const shares = (p: Post) =>
		(p.tags ?? []).filter((t) => tagIds.has(typeof t === 'string' ? t : (t as { id?: string }).id)).length;
	// Posts sharing a tag first, then the newest.
	const related = others
		.map((p, i) => ({ p, i, n: shares(p) }))
		.sort((a, b) => b.n - a.n || a.i - b.i)
		.slice(0, 3)
		.map((x) => x.p);
	return { post, related, design: designFor('post', site, devPick(url) ?? post.design) };
};
