import { nav } from 'virtual:kitcms-docs';
import type { LayoutServerLoad } from './$types';

// Docs are rendered at build time (`build/docs.ts`) and prerendered. Only the nav is shared here.
export const prerender = true;

export const load: LayoutServerLoad = () => ({ nav });
