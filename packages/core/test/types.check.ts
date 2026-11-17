// Compile-time assertions for config inference (plan §4.4). `tsc` fails if any is wrong.
import { block, collection, defineConfig, fields as f, type LocalAPI } from '../src/index';

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assert = <T extends true>(value: T) => void value;

const Hero = block({
	slug: 'hero',
	fields: { heading: f.text({ required: true }), image: f.upload({ relationTo: 'media' }) },
});
const Amenities = block({
	slug: 'amenities',
	fields: {
		items: f.array({
			fields: { label: f.text({ required: true }), icon: f.select({ options: ['wifi', 'pool'] }) },
		}),
	},
});

export const config = defineConfig({
	collections: [
		collection({ slug: 'media', upload: true, fields: { alt: f.text() } }),
		collection({ slug: 'users', auth: true, fields: { bio: f.textarea() } }),
		collection({
			slug: 'pages',
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'views'] },
			defaultSort: '-views',
			access: {
				read: ({ req }) => (req.user ? true : { template: { equals: 'resort' } }),
			},
			hooks: {
				beforeChange: ({ data }) => {
					const t: string | undefined = data.title;
					void t;
				},
			},
			fields: {
				title: f.text({ required: true, validate: (v) => (v === 'x' ? 'no' : true) }),
				slug: f.slug({ from: 'title', required: true, unique: true }),
				views: f.number({ min: 0 }),
				featured: f.checkbox(),
				template: f.select({ options: ['resort', { label: 'Boutique', value: 'boutique' }], required: true }),
				publishedAt: f.date(),
				parent: f.relationship({ relationTo: 'pages' }),
				tags: f.relationship({ relationTo: 'pages', hasMany: true }),
				seo: f.group({ fields: { metaTitle: f.text(), noindex: f.checkbox() } }),
				sections: f.blocks({ blocks: [Hero, Amenities] }),
				meta: f.row({ fields: { a: f.text({ required: true }), b: f.number() } }),
				more: f.tabs({
					tabs: [
						{ label: 'One', fields: { c: f.email() } },
						{ label: 'Two', fields: { d: f.json<{ x: number }>() } },
					],
				}),
			},
		}),
	],
});

declare const cms: LocalAPI<typeof config>;

export async function checks() {
	const { docs, totalDocs } = await cms.find('pages', {
		where: { views: { greater_than: 3 }, template: { equals: 'resort' }, tags: { contains: 'x' } },
		sort: '-views',
	});
	assert<Equal<typeof totalDocs, number>>(true);
	void totalDocs;
	const page = docs[0]!;
	assert<Equal<typeof page.id, string>>(true);
	assert<Equal<typeof page.createdAt, string>>(true);
	assert<Equal<typeof page.title, string>>(true);
	assert<Equal<typeof page.slug, string>>(true);
	assert<Equal<typeof page.views, number | null | undefined>>(true);
	assert<Equal<typeof page.featured, boolean>>(true);
	assert<Equal<typeof page.template, 'resort' | 'boutique'>>(true);
	assert<Equal<typeof page.publishedAt, string | null | undefined>>(true);
	assert<Equal<typeof page.seo.noindex, boolean>>(true);
	assert<Equal<typeof page.a, string>>(true); // hoisted from row
	assert<Equal<typeof page.b, number | null | undefined>>(true);
	assert<Equal<typeof page.c, string | null | undefined>>(true); // hoisted from tabs
	assert<Equal<typeof page.d, { x: number } | null | undefined>>(true);
	const tag: string = page.tags[0]!;
	void tag;

	const s = page.sections[0]!;
	assert<Equal<typeof s.id, string>>(true);
	if (s.blockType === 'hero') {
		assert<Equal<typeof s.heading, string>>(true);
		const img: string | null | undefined = s.image;
		void img;
	} else {
		assert<Equal<NonNullable<typeof s.items>[number]['icon'], 'wifi' | 'pool' | null | undefined>>(true);
	}

	const p1 = await cms.findByID('pages', 'x', { depth: 1 });
	const s1 = p1!.sections[0]!;
	if (s1.blockType === 'hero' && s1.image && typeof s1.image !== 'string') {
		assert<Equal<typeof s1.image.alt, string | null | undefined>>(true);
		assert<Equal<typeof s1.image.url, string>>(true);
	}

	const user = await cms.findByID('users', 'u');
	assert<Equal<NonNullable<typeof user>['email'], string>>(true);
	void user;

	// create: required-without-default only. slug has `from`, checkbox/group/blocks default.
	await cms.create('pages', { title: 'Hi', template: 'resort', a: 'x' });
	await cms.create('pages', {
		title: 'Hi',
		template: 'resort',
		a: 'x',
		parent: 'some-id',
		tags: ['a', 'b'],
		sections: [{ blockType: 'hero', heading: 'H' }],
	});
	await cms.update('pages', 'id', { views: 3 });
	await cms.create('users', { email: 'a@b.c', name: 'A' });

	// @ts-expect-error unknown collection
	await cms.find('nope');
	// @ts-expect-error unknown where field
	await cms.find('pages', { where: { nope: { equals: 1 } } });
	// @ts-expect-error JSON fields are not filterable
	await cms.find('pages', { where: { seo: { equals: 'x' } } });
	// @ts-expect-error `like` is for strings only
	await cms.find('pages', { where: { views: { like: 'x' } } });
	// @ts-expect-error unknown sort key
	await cms.find('pages', { sort: 'nope' });
	// @ts-expect-error missing required title
	await cms.create('pages', { template: 'resort', a: 'x' });
	// @ts-expect-error wrong select value
	await cms.create('pages', { title: 'x', template: 'nope', a: 'x' });
	// @ts-expect-error unknown block type
	await cms.create('pages', { title: 'x', template: 'resort', a: 'x', sections: [{ blockType: 'nope' }] });

	collection({
		slug: 'bad',
		// @ts-expect-error useAsTitle must be a field
		admin: { useAsTitle: 'nope' },
		fields: { title: f.text() },
	});
}

// Untyped (unregistered) config: everything is a generic document.
declare const untyped: LocalAPI;
export async function untypedChecks() {
	const { docs } = await untyped.find('anything', { where: { foo: { equals: 'x' } } });
	const v: unknown = docs[0]!.foo;
	void v;
	assert<Equal<typeof docs[0], import('../src/index').GenericDoc>>(true);
}
