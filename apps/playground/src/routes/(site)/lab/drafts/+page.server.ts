import { ForbiddenError } from '@kitcms/core';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const published = await locals.cms.find('pages', { sort: 'title', limit: 100, pagination: false });
	// A draft read is for signed-in users only; for a visitor it is refused.
	let all: { id: string; title: string; status: string }[] | null = null;
	let refused = false;
	try {
		const res = await locals.cms.find('pages', { draft: true, sort: 'title', limit: 100, pagination: false });
		all = res.docs.map((p) => ({ id: p.id, title: String(p.title ?? ''), status: String(p._status ?? '') }));
	} catch (err) {
		if (!(err instanceof ForbiddenError)) throw err;
		refused = true;
	}
	return {
		published: published.docs.map((p) => ({ id: p.id, title: String(p.title ?? '') })),
		all,
		refused,
	};
};
