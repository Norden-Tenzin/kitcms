import { block, collection, defineConfig, fields as f, global } from '@kitcms/core';
import { seo } from '@kitcms/plugin-seo';
import { ICONS } from '#lib/icons.ts';
import { docsPaths } from '#lib/docs/paths.ts';

// kitcms.dev: the landing page, changelog/blog, media and SEO are CMS content (dogfooding).
// The docs are Markdown in `src/docs/` (Decision 39) and never touch D1.

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** `/path` or an http(s) URL. Rejects `javascript:` and protocol-relative `//host`. */
const isHref = (value: string) => /^\/(?!\/)/.test(value) || /^https?:\/\//.test(value);
const href = (label: string, required = false) =>
	f.text({
		label,
		required,
		validate: (value) => !value || isHref(value) || 'Use a /path or an https:// URL.',
		admin: { placeholder: '/docs or https://...' },
	});
/** A label + link pair, used by buttons. Both empty = no button. */
const button = (label: string) =>
	f.group({
		label,
		fields: { label: f.text(), href: href('Link') },
	});
const isHex = (value: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);

/** Languages the code showcase can highlight (Shiki, at render time on the server). */
export const CODE_LANGUAGES = ['ts', 'svelte', 'sh', 'jsonc'] as const;

// ---------------------------------------------------------------------------------------------
// Landing blocks (§18.3). Each one has a Svelte component of the same name in
// `src/lib/blocks/`, used by the site and, through `src/kitcms.admin.ts`, as the live preview.
// ---------------------------------------------------------------------------------------------

const Hero = block({
	slug: 'hero',
	fields: {
		eyebrow: f.text({ admin: { description: 'Small line above the headline, e.g. the version.' } }),
		heading: f.text({ required: true }),
		subheading: f.textarea(),
		/** Shown with a copy button. */
		installCommand: f.text({ defaultValue: 'pnpm create kitcms@latest my-site' }),
		primary: button('Primary button'),
		secondary: button('Secondary button'),
	},
});

const Features = block({
	slug: 'features',
	labels: { singular: 'Feature grid', plural: 'Feature grids' },
	fields: {
		title: f.text(),
		intro: f.textarea(),
		items: f.array({
			maxRows: 12,
			labels: { singular: 'Feature', plural: 'Features' },
			fields: {
				icon: f.select({ options: ICONS }),
				title: f.text({ required: true }),
				text: f.textarea(),
			},
		}),
	},
});

const CodeShowcase = block({
	slug: 'codeShowcase',
	labels: { singular: 'Code showcase', plural: 'Code showcases' },
	// A config snippet next to the admin screen it produces.
	fields: {
		title: f.text(),
		text: f.textarea(),
		filename: f.text({ defaultValue: 'src/kitcms.config.ts' }),
		language: f.select({ options: CODE_LANGUAGES, defaultValue: 'ts' }),
		code: f.textarea({ required: true, admin: { rows: 16 } }),
		image: f.upload({ relationTo: 'media', label: 'Screenshot' }),
		/** Used when no screenshot is uploaded and as the image's caption. */
		caption: f.text(),
	},
});

const HowItWorks = block({
	slug: 'howItWorks',
	labels: { singular: 'How it works', plural: 'How it works' },
	// Two deployment modes. The diagram is drawn by the component, not uploaded.
	fields: {
		title: f.text(),
		intro: f.textarea(),
		fullApp: f.group({
			label: 'Full app',
			fields: { title: f.text({ required: true }), text: f.textarea() },
		}),
		headless: f.group({
			label: 'Headless',
			fields: {
				title: f.text({ required: true }),
				text: f.textarea(),
				code: f.textarea({ label: 'Code sample (TypeScript)', admin: { rows: 8 } }),
			},
		}),
	},
});

const Requirements = block({
	slug: 'requirements',
	fields: {
		title: f.text(),
		intro: f.textarea(),
		items: f.array({
			maxRows: 8,
			labels: { singular: 'Requirement', plural: 'Requirements' },
			fields: {
				name: f.text({ required: true }),
				why: f.textarea({ label: 'Why' }),
				href: href('Learn more link'),
			},
		}),
	},
});

const Cta = block({
	slug: 'cta',
	labels: { singular: 'Call to action', plural: 'Calls to action' },
	fields: {
		heading: f.text({ required: true }),
		text: f.textarea(),
		installCommand: f.text({ admin: { description: 'Optional, shown with a copy button.' } }),
		primary: button('Primary button'),
		secondary: button('Secondary button'),
	},
});

const RichText = block({
	slug: 'richText',
	labels: { singular: 'Rich text', plural: 'Rich text' },
	fields: { body: f.richText() },
});

export const pageBlocks = [Hero, Features, CodeShowcase, HowItWorks, Requirements, Cta, RichText] as const;

// ---------------------------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------------------------

export default defineConfig({
	admin: { title: 'kitcms.dev' },
	// Invites and password-reset links. mail.kitcms.dev is set up for Cloudflare Email Sending.
	email: { from: { address: 'noreply@mail.kitcms.dev', name: 'kitcms.dev' } },
	// Edge cache for anonymous published reads (custom domain only; no effect on workers.dev).
	cache: { ttl: 60 },
	collections: [
		collection({
			slug: 'media',
			upload: { mimeTypes: ['image/*'] },
			access: { read: () => true },
			fields: { alt: f.text({ label: 'Alt text', required: true }) },
		}),
		collection({
			slug: 'pages',
			orderable: true,
			versions: { drafts: { autosave: true } },
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status', 'updatedAt'] },
			access: { read: () => true },
			fields: {
				title: f.text({ required: true }),
				// `home` is served at `/`. `docs`, `blog`, `admin` and `api` are taken by routes.
				slug: f.slug({
					from: 'title',
					unique: true,
					validate: (value) =>
						!value ||
						!['docs', 'blog', 'admin', 'api'].includes(value) ||
						'This slug is used by a route. Pick another.',
					admin: { position: 'sidebar' },
				}),
				sections: f.blocks({ blocks: pageBlocks }),
			},
		}),
		collection({
			slug: 'posts',
			labels: { singular: 'Post', plural: 'Changelog & blog' },
			versions: { drafts: true },
			defaultSort: '-publishedAt',
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'publishedAt', '_status'] },
			access: { read: () => true },
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				publishedAt: f.date({ required: true, admin: { position: 'sidebar' } }),
				kind: f.select({
					options: ['release', 'post'],
					defaultValue: 'post',
					admin: { position: 'sidebar', description: '`release` shows a version badge.' },
				}),
				version: f.text({ admin: { position: 'sidebar', placeholder: '0.1.1' } }),
				excerpt: f.textarea({ maxLength: 300 }),
				cover: f.upload({ relationTo: 'media' }),
				body: f.richText(),
			},
		}),
	],
	globals: [
		global({
			slug: 'site',
			label: 'Site settings',
			access: { read: () => true },
			fields: {
				settings: f.tabs({
					tabs: [
						{
							label: 'General',
							fields: {
								siteName: f.text({ required: true, defaultValue: 'kitcms' }),
								tagline: f.textarea(),
								githubUrl: href('GitHub URL'),
								npmUrl: href('npm URL'),
								nav: f.array({
									labels: { singular: 'Link', plural: 'Navigation' },
									maxRows: 6,
									fields: { label: f.text({ required: true }), href: href('Link', true) },
								}),
							},
						},
						{
							label: 'Footer',
							fields: {
								footerColumns: f.array({
									labels: { singular: 'Column', plural: 'Columns' },
									maxRows: 4,
									fields: {
										title: f.text({ required: true }),
										links: f.array({
											labels: { singular: 'Link', plural: 'Links' },
											fields: { label: f.text({ required: true }), href: href('Link', true) },
										}),
									},
								}),
								footerNote: f.textarea(),
							},
						},
						{
							label: 'Design',
							description:
								'The site has one design with a light and a dark theme. Only the accent colour is editable; empty uses the default.',
							fields: {
								theme: f.group({
									label: 'Colours',
									fields: {
										accentLight: f.text({
											label: 'Accent (light theme)',
											maxLength: 7,
											validate: (v) => !v || isHex(v) || 'Use a hex colour such as #c2410c.',
										}),
										accentDark: f.text({
											label: 'Accent (dark theme)',
											maxLength: 7,
											validate: (v) => !v || isHex(v) || 'Use a hex colour such as #fb923c.',
										}),
									},
								}),
							},
						},
					],
				}),
			},
		}),
	],
	plugins: [
		seo({
			collections: ['pages', 'posts'],
			uploadsCollection: 'media',
			redirects: true,
			sitemap: {
				collections: {
					pages: (doc) => (doc.slug === 'home' ? '/' : `/${String(doc.slug)}`),
					posts: '/blog/:slug',
				},
				// Docs are prerendered Markdown, not CMS docs. `docsPaths` is a build-time list (a virtual
				// module filled from the file names in `src/docs/`), so no Markdown reaches the Worker.
				paths: ['/blog', '/docs', ...docsPaths],
			},
			robots: true,
		}),
	],
});
