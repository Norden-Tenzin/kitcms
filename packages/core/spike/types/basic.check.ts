// SPIKE: compile-time assertions for the inference prototype. `tsc` fails if any is wrong.
import { block, collection, defineConfig, f, type LocalAPI } from './kit.ts';

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
		collection({
			slug: 'pages',
			admin: { useAsTitle: 'title' },
			fields: {
				title: f.text({ required: true }),
				views: f.number(),
				template: f.select({ options: ['resort', 'boutique'], required: true }),
				parent: f.relationship({ relationTo: 'pages' }),
				seo: f.group({ fields: { metaTitle: f.text() } }),
				sections: f.blocks({ blocks: [Hero, Amenities] }),
			},
		}),
	],
});

declare const cms: LocalAPI<typeof config>;

export async function checks() {
	const { docs } = await cms.find('pages', {
		where: { views: { greater_than: 3 }, template: { equals: 'resort' } },
		sort: '-views',
	});
	const page = docs[0]!;
	assert<Equal<typeof page.title, string>>(true);
	assert<Equal<typeof page.views, number | null | undefined>>(true);
	assert<Equal<typeof page.template, 'resort' | 'boutique'>>(true);

	const s = page.sections[0]!;
	if (s.blockType === 'hero') {
		assert<Equal<typeof s.heading, string>>(true);
		const img: string | null | undefined = s.image; // depth 0 → id
		void img;
	} else {
		assert<Equal<NonNullable<typeof s.items>[number]['icon'], 'wifi' | 'pool' | null | undefined>>(
			true,
		);
	}

	const p1 = await cms.findByID('pages', 'x', { depth: 1 });
	const s1 = p1!.sections[0]!;
	if (s1.blockType === 'hero' && s1.image && typeof s1.image !== 'string') {
		assert<Equal<typeof s1.image.alt, string | null | undefined>>(true); // populated media
	}

	// @ts-expect-error unknown collection
	await cms.find('nope');
	// @ts-expect-error unknown where field
	await cms.find('pages', { where: { nope: { equals: 1 } } });
	// @ts-expect-error JSON fields are not filterable
	await cms.find('pages', { where: { seo: { equals: 'x' } } });
	// @ts-expect-error missing required title
	await cms.create('pages', { template: 'resort', sections: [] });
}
