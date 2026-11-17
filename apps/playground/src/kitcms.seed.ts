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

	// Tenancy playground: two vendors (`a.localhost:5173`, `b.localhost:5173`) with one room each.
	// The seed is trusted code without a tenant, so the tenant is passed explicitly.
	for (const [slug, name, room] of [
		['a', 'Vendor A', 'Room A1'],
		['b', 'Vendor B', 'Room B1'],
	] as const) {
		const vendor = await ensure('vendors', { where: { slug: { equals: slug } }, data: { name, slug } });
		// `tenant` is added by the plugin, so it isn't in the config's inferred types.
		await ensure('rooms', {
			where: { and: [{ name: { equals: room } }, { tenant: { equals: vendor.id } }] } as never,
			data: { name: room, tenant: vendor.id, price: 100 } as never,
		});
	}

	await ensureGlobal('site', { siteName: 'kitcms dev' });
});
