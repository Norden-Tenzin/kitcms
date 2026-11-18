import { loadShell } from '#lib/site/content.ts';
import type { LayoutServerLoad } from './$types';

// Site settings and legal pages for every public page. Anonymous reads are cached at the edge when
// `cache` is on in the config.
export const load: LayoutServerLoad = ({ locals }) => loadShell(locals.cms);
