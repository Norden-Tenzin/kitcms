// Idempotent seed: `pnpm db:seed` (local) or `kitcms seed --remote`. Existing documents are never
// overwritten, so it is safe to run again after editors changed things.
import { defineSeed } from '@kitcms/core';

export default defineSeed(async ({ ensure, ensureGlobal }) => {
	await ensure('legal', { where: { slug: { equals: 'privacy-policy' } }, data: { title: 'Privacy policy' } });
	await ensure('legal', { where: { slug: { equals: 'terms' } }, data: { title: 'Terms' } });

	for (const [name, role] of [
		['Ada Lovelace', 'Founder'],
		['Grace Hopper', 'Engineering'],
		['Alan Turing', 'Research'],
	] as const) {
		await ensure('team', { where: { name: { equals: name } }, data: { name, role } });
	}

	await ensureGlobal('site', { siteName: 'kitcms dev' });
});
