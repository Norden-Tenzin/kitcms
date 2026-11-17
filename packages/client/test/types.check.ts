/* eslint-disable @typescript-eslint/no-unused-vars */
// Type-level checks, compiled by `tsc` (no runtime). `@ts-expect-error` lines must error.
import { kitcms, type KitcmsBinding, type Rel } from '../src/index';

interface Category {
	id: string;
	createdAt: string;
	updatedAt: string;
	name: string;
}
interface Post {
	id: string;
	createdAt: string;
	updatedAt: string;
	title: string;
	views?: number | null;
	status: 'draft' | 'published';
	category: Rel<'categories'>;
	tags: Rel<'categories'>[];
	meta: { description?: string | null };
}
interface Site {
	id: string;
	siteName: string;
	logo?: Rel<'categories'> | null;
}
interface Types {
	collections: { posts: Post; categories: Category };
	globals: { site: Site };
}

declare const binding: KitcmsBinding;
const cms = kitcms<Types>(binding);

type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assert<_T extends true>() {}

export async function checks() {
	const a = await cms.find('posts', {
		where: { status: { equals: 'published' }, views: { greater_than: 1 }, or: [{ title: { like: 'x' } }], tags: { contains: 'id' } },
		sort: '-createdAt',
		limit: 5,
		as: 'system',
	});
	assert<Eq<typeof a.docs[number]['title'], string>>();
	assert<Eq<typeof a.docs[number]['category'], Rel<'categories'>>>();
	assert<Eq<typeof a.totalDocs, number>>();

	const d1 = await cms.find('posts', { depth: 1 });
	const c = d1.docs[0]!.category;
	assert<Eq<typeof c, Category | string>>();

	const one = await cms.findOne('posts', { depth: 2, sort: 'title' });
	assert<Eq<typeof one extends null ? never : true, true>>();
	const byId = await cms.findByID('categories', 'x');
	assert<Eq<typeof byId, Category | null>>();
	assert<Eq<Awaited<ReturnType<typeof cms.count>>, number>>();
	await cms.count('posts', { where: { status: { in: ['draft'] } } });
	assert<Eq<Awaited<ReturnType<typeof cms.getMediaUrl>>, string | null>>();

	// @ts-expect-error unknown collection
	await cms.find('nope');
	// @ts-expect-error status is not one of the literals
	await cms.find('posts', { where: { status: { equals: 'archived' } } });
	// @ts-expect-error unknown where field
	await cms.find('posts', { where: { nope: { equals: 1 } } });
	// @ts-expect-error json-ish nested group is not filterable
	await cms.find('posts', { where: { meta: { equals: 'x' } } });
	// @ts-expect-error unknown sort key
	await cms.find('posts', { sort: 'nope' });
	// @ts-expect-error depth max is 2
	await cms.find('posts', { depth: 3 });
	// @ts-expect-error `as` only accepts 'system'
	await cms.find('posts', { as: 'admin' });
	// @ts-expect-error `like` is for strings only
	await cms.find('posts', { where: { views: { like: 'a' } } });

	// Untyped fallback
	const loose = kitcms(binding);
	const g = await loose.find('anything', { where: { whatever: { equals: 1 } }, sort: '-x' });
	assert<Eq<typeof g.docs[number]['id'], string>>();

	// Globals
	const site = await cms.findGlobal('site');
	assert<Eq<typeof site.siteName, string>>();
	const site1 = await cms.findGlobal('site', { depth: 1 });
	assert<Eq<typeof site1.logo, Category | string | null | undefined>>();
	// @ts-expect-error unknown global
	await cms.findGlobal('nope');

	// Drafts need system
	await cms.findByID('posts', 'x', { draft: true, as: 'system' });
	// @ts-expect-error drafts are not readable anonymously
	await cms.findByID('posts', 'x', { draft: true });

	// Writes need system
	const created = await cms.create('posts', { title: 'x', category: 'c1', tags: ['c1'] }, { as: 'system' });
	assert<Eq<typeof created.title, string>>();
	// @ts-expect-error writes need as: 'system'
	await cms.create('posts', { title: 'x' }, {});
	// @ts-expect-error options are required
	await cms.update('posts', 'id', { title: 'y' });
	await cms.update('posts', 'id', { title: 'y' }, { as: 'system', draft: true });
	await cms.delete('posts', 'id', { as: 'system' });
	await cms.move('posts', 'id', { after: 'id2' }, { as: 'system' });
	// @ts-expect-error exactly one of before/after
	await cms.move('posts', 'id', { after: 'a', before: 'b' }, { as: 'system' });
	await cms.unpublish('posts', 'id', { as: 'system' });
	await cms.updateGlobal('site', { siteName: 'x', logo: 'c1' }, { as: 'system' });
}
