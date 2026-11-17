// Block types matching ./payload.ts, for the hidden `bench` collection (scripts/bench).
import { block, fields as f } from '@kitcms/core';

const link = { label: f.text(), href: f.text() };

export const benchBlocks = [
	block({
		slug: 'hero',
		fields: {
			heading: f.text(),
			subheading: f.textarea(),
			image: f.upload({ relationTo: 'media' }),
			cta: f.group({ fields: { ...link, variant: f.text() } }),
		},
	}),
	block({ slug: 'richText', fields: { heading: f.text(), body: f.json() } }),
	block({
		slug: 'amenities',
		fields: { heading: f.text(), items: f.array({ fields: { label: f.text(), icon: f.text() } }) },
	}),
	block({
		slug: 'gallery',
		fields: {
			heading: f.text(),
			images: f.array({ fields: { image: f.upload({ relationTo: 'media' }), caption: f.text() } }),
		},
	}),
	block({
		slug: 'split',
		fields: {
			heading: f.text(),
			text: f.textarea(),
			image: f.upload({ relationTo: 'media' }),
			reverse: f.checkbox(),
			links: f.array({ fields: link }),
		},
	}),
] as const;
