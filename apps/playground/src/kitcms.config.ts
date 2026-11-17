// The playground config: exercises every v1 field type.
import { block, collection, defineConfig, fields as f, global } from '@kitcms/core';
import { multiTenant, tenantByHost } from '@kitcms/plugin-multi-tenant';
import { seo } from '@kitcms/plugin-seo';

const Hero = block({
	slug: 'hero',
	fields: {
		heading: f.text({ required: true }),
		subheading: f.textarea(),
		image: f.upload({ relationTo: 'media' }),
	},
});

const Features = block({
	slug: 'features',
	fields: {
		title: f.text(),
		items: f.array({
			fields: {
				label: f.text({ required: true }),
				icon: f.select({ options: ['wifi', 'pool', 'spa', 'parking'] }),
			},
			maxRows: 6,
		}),
	},
});

export default defineConfig({
	admin: { title: 'kitcms dev' },
	plugins: [
		// Tenancy playground: `a.localhost:5173` resolves to the vendor with slug `a`. `media` and
		// `pages` stay unscoped (shared content).
		multiTenant({
			tenantsCollection: 'vendors',
			collections: ['rooms'],
			resolveTenant: tenantByHost({
				collection: 'vendors',
				domainField: 'domain',
				subdomain: { field: 'slug', rootDomain: 'localhost' },
			}),
		}),
		seo({ collections: ['pages'], uploadsCollection: 'media' }),
	],
	collections: [
		collection({
			slug: 'vendors',
			access: { read: () => true },
			admin: { useAsTitle: 'name', group: 'Tenancy' },
			fields: { name: f.text({ required: true }), slug: f.text({ unique: true }), domain: f.text() },
		}),
		collection({
			slug: 'rooms',
			access: { read: () => true },
			admin: { group: 'Tenancy' },
			fields: {
				name: f.text({ required: true }),
				slug: f.slug({ from: 'name', unique: true }),
				photo: f.upload({ relationTo: 'media' }),
				price: f.number(),
			},
		}),
		collection({
			slug: 'media',
			upload: { mimeTypes: ['image/*', 'application/pdf'] },
			access: { read: () => true },
			fields: { alt: f.text() },
		}),
		collection({
			slug: 'pages',
			// Drafts + autosave (§13.4): public reads only ever see published pages.
			versions: { drafts: { autosave: true }, max: 20 },
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status', 'updatedAt'] },
			access: { read: () => true },
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				publishedAt: f.date({ admin: { position: 'sidebar' } }),
				featured: f.checkbox({ admin: { position: 'sidebar' } }),
				content: f.tabs({
					tabs: [
						{
							label: 'Content',
							fields: {
								cover: f.upload({ relationTo: 'media' }),
								sections: f.blocks({ blocks: [Hero, Features] }),
							},
						},
						{
							label: 'SEO',
							fields: {
								seo: f.group({
									fields: {
										metaTitle: f.text({ maxLength: 70 }),
										metaDescription: f.textarea({ maxLength: 160 }),
										noindex: f.checkbox(),
									},
								}),
							},
						},
					],
				}),
				parent: f.relationship({ relationTo: 'pages' }),
				related: f.relationship({ relationTo: 'pages', hasMany: true }),
				gallery: f.upload({ relationTo: 'media', hasMany: true }),
				views: f.number({ integer: true, min: 0 }),
				contactEmail: f.email(),
				extra: f.json<{ notes?: string }>(),
			},
		}),
		// Orderable (§13.2): drag to reorder in the admin list; `find` returns them in that order.
		collection({
			slug: 'team',
			orderable: true,
			admin: { useAsTitle: 'name', defaultColumns: ['name', 'role'] },
			access: { read: () => true },
			fields: {
				name: f.text({ required: true }),
				role: f.text(),
				photo: f.upload({ relationTo: 'media' }),
			},
		}),
		// Locked (§13.3): created by `pnpm db:seed`; editors can edit but not create or delete.
		collection({
			slug: 'legal',
			admin: { locked: true, useAsTitle: 'title', defaultColumns: ['title', 'slug', 'updatedAt'] },
			access: { read: () => true },
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				body: f.richText(),
			},
		}),
	],
	globals: [
		global({
			slug: 'site',
			label: 'Site settings',
			versions: { drafts: true },
			access: { read: () => true },
			fields: {
				siteName: f.text({ required: true }),
				tagline: f.textarea(),
				logo: f.upload({ relationTo: 'media' }),
				nav: f.array({
					fields: { label: f.text({ required: true }), page: f.relationship({ relationTo: 'pages' }) },
				}),
			},
		}),
	],
});
