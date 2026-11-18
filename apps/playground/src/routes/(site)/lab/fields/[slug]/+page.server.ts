import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const doc = await locals.cms.findOne('kitchen-sink', { where: { slug: { equals: params.slug } }, depth: 1 });
	if (!doc) error(404, 'Document not found');
	return { doc: doc as unknown as Record<string, unknown> };
};
