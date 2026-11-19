import { building } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { kitcms } from '@kitcms/core/sveltekit';
import config from './kitcms.config';

// Prerendered routes (the docs) are rendered during `vite build`, where there are no D1/R2 bindings.
// They never read content, so skip kitcms then.
const cms = kitcms({ config }).handle;
export const handle: Handle = building ? ({ event, resolve }) => resolve(event) : cms;
