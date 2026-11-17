import { collection, defineConfig, fields as f } from '@kitcms/core';

export default defineConfig({
	admin: { title: '__APP_NAME__' },
	collections: [
		collection({
			slug: 'media',
			upload: { mimeTypes: ['image/*', 'application/pdf'] },
			access: { read: () => true },
			fields: { alt: f.text() },
		}),
		collection({
			slug: 'pages',
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'status', 'updatedAt'] },
			access: {
				// Published pages are public; signed-in users also see drafts.
				read: ({ req }) => (req.user ? true : { status: { equals: 'published' } }),
			},
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				status: f.select({
					options: ['draft', 'published'],
					defaultValue: 'draft',
					required: true,
					admin: { position: 'sidebar' },
				}),
				body: f.textarea(),
			},
		}),
	],
});
