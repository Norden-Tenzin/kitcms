import { designFor } from '#lib/site/content.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { site } = await parent();
	return { design: designFor('contact', site) };
};
