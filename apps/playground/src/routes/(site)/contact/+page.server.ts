import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/devDesign.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { site } = await parent();
	return { design: designFor('contact', site, devPick(url)) };
};
