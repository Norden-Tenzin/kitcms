// Launch content for kitcms.dev: `pnpm db:seed` (local D1) or `pnpm db:seed:remote`.
// Idempotent: every document is created only when it does not exist yet, so running it again never
// overwrites what the editor changed. No media is seeded (blocks handle missing images).
import { defineSeed, type RichTextDoc, type RichTextNode } from '@kitcms/core';
import { GITHUB, siteDefaults } from '#lib/site-defaults.ts';

// ---- Tiptap JSON helpers ----------------------------------------------------------------------

const text = (value: string): RichTextNode => ({ type: 'text', text: value });
const p = (...content: string[]): RichTextNode => ({
	type: 'paragraph',
	content: content.map(text),
});
const h = (level: number, value: string): RichTextNode => ({
	type: 'heading',
	attrs: { level },
	content: [text(value)],
});
const ul = (...items: string[]): RichTextNode => ({
	type: 'bulletList',
	content: items.map((i) => ({ type: 'listItem', content: [p(i)] })),
});
const doc = (...content: RichTextNode[]): RichTextDoc => ({ type: 'doc', content });

// ---- Copy -------------------------------------------------------------------------------------

const INSTALL = 'pnpm create kitcms@latest my-site';

const CONFIG_SAMPLE = `import { collection, defineConfig, fields as f } from '@kitcms/core';

export default defineConfig({
	collections: [
		collection({
			slug: 'posts',
			versions: { drafts: { autosave: true } },
			access: { read: () => true },
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true }),
				publishedAt: f.date(),
				body: f.richText(),
			},
		}),
	],
});`;

const CLIENT_SAMPLE = `import { kitcms } from '@kitcms/client';
import type { KitcmsTypes } from './kitcms-types';

const cms = kitcms<KitcmsTypes>(env.CMS);
const { docs } = await cms.find('posts', { sort: '-publishedAt', limit: 10 });`;

// ---- Seed -------------------------------------------------------------------------------------

export default defineSeed(async ({ ensure, ensureGlobal, log }) => {
	const bySlug = (slug: string) => ({ slug: { equals: slug } });

	// Release post (published: the seed creates it without `draft`)
	await ensure('posts', {
		where: bySlug('kitcms-0-1'),
		data: {
			slug: 'kitcms-0-1',
			title: 'kitcms 0.1',
			kind: 'release',
			version: '0.1.1',
			publishedAt: '2026-11-18T12:00:00.000Z',
			excerpt:
				'The first public release: a code-first CMS for SvelteKit that runs on Cloudflare Workers, D1 and R2.',
			body: doc(
				p('kitcms 0.1 is out on npm. Start a project with pnpm create kitcms@latest.'),
				h(2, "What's in it"),
				ul(
					'Collections, globals, blocks and every field type, defined in TypeScript',
					'A Svelte 5 admin with drafts, autosave, version history and live preview',
					'Access control and hooks on every read and write',
					'Sign-in with Better Auth, users and roles',
					'Uploads to R2 with image resizing',
					'The Local API, REST, and Service Binding RPC with a typed client',
					'Plugins: SEO (meta, sitemap, robots, redirects), enquiry forms and entitlements',
					'Two templates: blank and website',
				),
				h(2, 'Known issue'),
				p('0.1.0 failed to install from npm. Use 0.1.1 or later.'),
			),
		},
	});

	// Home page
	await ensure('pages', {
		where: bySlug('home'),
		data: {
			title: 'Home',
			slug: 'home',
			// `meta` is added by the SEO plugin, so it is not in the inferred type (spread skips the check).
			...{
				meta: {
					title: 'kitcms: the CMS for SvelteKit on Cloudflare',
					description:
						'A code-first CMS that installs into your SvelteKit app and runs on Cloudflare Workers, D1 and R2. Full app or headless over Service Bindings.',
				},
			},
			sections: [
				{
					blockType: 'hero',
					eyebrow: 'v0.1 · open source · MIT',
					heading: 'The CMS for SvelteKit on Cloudflare.',
					subheading:
						'Define your content in TypeScript and get a Svelte 5 admin, a typed Local API, drafts, versions and sign-in. It all runs on Workers, D1 and R2: as one Worker with your site, or headless over Service Bindings.',
					installCommand: INSTALL,
					primary: { label: 'Get started', href: '/docs/getting-started' },
					secondary: { label: 'View on GitHub', href: GITHUB },
				},
				{
					blockType: 'features',
					title: 'Everything lives in your repo',
					intro:
						'No separate CMS server, no hosted database to pay for, no schema clicked together in a dashboard.',
					items: [
						{
							icon: 'code',
							title: 'Schema is code',
							text: 'Collections, globals, blocks and fields are defined in kitcms.config.ts. Types are inferred, migrations are generated, and every change goes through code review.',
						},
						{
							icon: 'layers',
							title: 'One Worker',
							text: 'The admin, the API and your site deploy together as a single SvelteKit app on Cloudflare Workers.',
						},
						{
							icon: 'shield',
							title: 'One pipeline for every write',
							text: 'The admin, REST, RPC and your own server code all go through the same access rules, hooks and validation.',
						},
						{
							icon: 'history',
							title: 'Drafts, versions, live preview',
							text: 'Autosaved drafts, version history with restore, and previews rendered by your own Svelte components.',
						},
						{
							icon: 'image',
							title: 'Media on R2',
							text: "Uploads are stored in your own R2 bucket. Images are resized on the fly through Cloudflare's /cdn-cgi/image.",
						},
						{
							icon: 'plug',
							title: 'Headless when you need it',
							text: 'Other Workers read content over a Service Binding with a typed client. No public API keys, no extra network hop.',
						},
					],
				},
				{
					blockType: 'codeShowcase',
					title: 'Write a collection. Get an admin.',
					text: 'This is the whole definition. kitcms generates the D1 migration, the admin list and edit form, and the types your pages query with.',
					filename: 'src/kitcms.config.ts',
					language: 'ts',
					caption: 'The posts edit screen in the kitcms admin',
					code: CONFIG_SAMPLE,
				},
				{
					blockType: 'howItWorks',
					title: 'A full app or headless',
					intro: 'Same config, same API. Pick how content reaches your users.',
					fullApp: {
						title: 'Full app',
						text: 'Your site, the admin and the API are one SvelteKit app, deployed as one Worker. Pages read content with the Local API: a function call, not an HTTP request.',
					},
					headless: {
						title: 'Headless over RPC',
						text: 'Keep content in one Worker and read it from others through a Service Binding. Calls stay inside Cloudflare and are typed end to end.',
						code: CLIENT_SAMPLE,
					},
				},
				{
					blockType: 'requirements',
					title: 'What you need',
					intro:
						'kitcms runs only on Cloudflare. That is the point: no servers to run, and content sits next to your code.',
					items: [
						{
							name: 'Workers Paid plan',
							why: "Passwords are hashed with scrypt, which needs more CPU time per request than the Free plan's 10 ms limit.",
							href: '/docs/getting-started/requirements',
						},
						{
							name: 'D1',
							why: 'Content, users and versions live in a D1 database, created with one wrangler command.',
						},
						{
							name: 'R2',
							why: 'Uploaded files are stored in an R2 bucket you own.',
						},
					],
				},
				{
					blockType: 'cta',
					heading: 'Start a site in a minute',
					text: 'Scaffold, migrate, run. Local D1 and R2 work without a Cloudflare account.',
					installCommand: INSTALL,
					primary: { label: 'Read the docs', href: '/docs/getting-started' },
					secondary: { label: "What's in 0.1", href: '/blog/kitcms-0-1' },
				},
			],
		},
	});

	// Site settings
	await ensureGlobal('site', siteDefaults);
	log('Seed done. Open /admin to edit it.');
});
