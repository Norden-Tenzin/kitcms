import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Both reads act as the visitor: the notes rule returns a `where` for anonymous users.
	const [notes, sink] = await Promise.all([
		locals.cms.find('notes', { sort: 'title', limit: 100, pagination: false }),
		locals.cms.find('kitchen-sink', { limit: 1, pagination: false }),
	]);
	const first = sink.docs[0] as Record<string, unknown> | undefined;
	return {
		notes: notes.docs.map((n) => ({ id: n.id, title: String(n.title ?? ''), visibility: String(n.visibility ?? '') })),
		sampleTitle: first ? String(first.title ?? '') : null,
		internalNote: first && 'internalNote' in first && first.internalNote !== undefined ? String(first.internalNote ?? '') : null,
	};
};
