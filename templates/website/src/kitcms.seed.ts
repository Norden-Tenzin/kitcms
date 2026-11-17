// Example content: `pnpm db:seed` (local D1) or `pnpm db:seed:remote`.
// Idempotent: every document is created only when it does not exist yet, so running it again never
// overwrites what editors changed. No media is seeded (blocks handle missing images); upload
// images in the admin and attach them.
import { defineSeed, type RichTextDoc, type RichTextNode } from '@kitcms/core';

// ---- Tiptap JSON helpers ----------------------------------------------------------------------

const text = (value: string, marks?: RichTextNode['marks']): RichTextNode => ({
	type: 'text',
	text: value,
	...(marks ? { marks } : {}),
});
const p = (...content: (string | RichTextNode)[]): RichTextNode => ({
	type: 'paragraph',
	content: content.map((c) => (typeof c === 'string' ? text(c) : c)),
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
const bold = (value: string) => text(value, [{ type: 'bold' }]);

// ---- Seed -------------------------------------------------------------------------------------

export default defineSeed(async ({ ensure, ensureGlobal, log }) => {
	const bySlug = (slug: string) => ({ slug: { equals: slug } });

	// Tags
	const news = await ensure('tags', {
		where: bySlug('news'),
		data: { name: 'News', slug: 'news' },
	});
	const guides = await ensure('tags', {
		where: bySlug('guides'),
		data: { name: 'Guides', slug: 'guides' },
	});

	// Posts (published: the seed creates them without `draft`)
	const posts = [
		{
			slug: 'welcome-to-our-new-site',
			title: 'Welcome to our new site',
			publishedAt: '2026-11-10T09:00:00.000Z',
			tags: [news.id],
			excerpt: 'We rebuilt our website. Here is what is new and where to find everything.',
			body: doc(
				p(
					'We rebuilt our website to make it faster, simpler and easier for us to keep up to date.',
				),
				h(2, 'What is new'),
				ul(
					'A new blog, where we will share news and guides',
					'A page for the team behind the work',
					'Clearer contact details on every page',
				),
				p('Thank you for visiting. ', bold('Tell us what you think.')),
			),
		},
		{
			slug: 'how-we-work',
			title: 'How we work',
			publishedAt: '2026-11-03T09:00:00.000Z',
			tags: [guides.id],
			excerpt: 'A short look at our process, from the first conversation to delivery.',
			body: doc(
				p('Every project starts with a conversation. We listen first, then propose a plan.'),
				h(2, 'Our process'),
				ul(
					'Discover: we learn what you need',
					'Design: we agree on the approach',
					'Deliver: we ship in small steps',
				),
				p('Questions? We are happy to talk it through.'),
			),
		},
		{
			slug: 'three-tips-for-a-small-website',
			title: 'Three tips for a small website',
			publishedAt: '2026-10-27T09:00:00.000Z',
			tags: [guides.id, news.id],
			excerpt: 'Keep it fast, keep it clear, keep it current.',
			body: doc(
				p('A small website does not need to be complicated. Three things matter most.'),
				ul(
					'Keep it fast: small images, few scripts',
					'Keep it clear: one goal per page',
					'Keep it current: update it when things change',
				),
				{ type: 'blockquote', content: [p('Good websites are mostly good editing.')] },
			),
		},
	];
	for (const post of posts) await ensure('posts', { where: bySlug(post.slug), data: post });

	// Team (in this order; editors can drag to reorder in the admin)
	for (const [name, role, bio] of [
		[
			'Alex Morgan',
			'Founder',
			'Starts every project with a conversation and ends it with a handover.',
		],
		['Sam Rivera', 'Design', 'Turns rough ideas into clear, usable pages.'],
		['Jordan Lee', 'Engineering', 'Keeps everything fast, secure and boring in the best way.'],
	] as const) {
		await ensure('team', { where: { name: { equals: name } }, data: { name, role, bio } });
	}

	// Legal pages (the collection is locked: only the seed can create them)
	await ensure('legal', {
		where: bySlug('privacy'),
		data: {
			title: 'Privacy',
			slug: 'privacy',
			body: doc(
				p('This is an example privacy policy. Replace it with your own text in the admin.'),
				h(2, 'What we collect'),
				p('Describe the personal data you collect, why you collect it and how long you keep it.'),
				h(2, 'Contact'),
				p('Tell visitors how to reach you with privacy questions.'),
			),
		},
	});
	await ensure('legal', {
		where: bySlug('terms'),
		data: {
			title: 'Terms',
			slug: 'terms',
			body: doc(
				p('These are example terms. Replace them with your own text in the admin.'),
				h(2, 'Using this site'),
				p('Describe the rules for using your site and services.'),
			),
		},
	});

	// Pages
	const home = await ensure('pages', {
		where: bySlug('home'),
		data: {
			title: 'Home',
			slug: 'home',
			sections: [
				{
					blockType: 'hero',
					heading: 'A small studio for careful work',
					subheading: 'We help small businesses look good online, without the complexity.',
					ctaLabel: 'Get in touch',
					ctaHref: '/about',
				},
				{
					blockType: 'features',
					title: 'Why work with us',
					items: [
						{
							title: 'Clear and simple',
							text: 'No jargon. You always know what happens next.',
							icon: 'chat',
						},
						{
							title: 'Built to last',
							text: 'Fast, accessible sites that are easy to keep up to date.',
							icon: 'shield',
						},
						{
							title: 'On time',
							text: 'Small steps, regular updates, no surprises.',
							icon: 'clock',
						},
					],
				},
				{ blockType: 'latestPosts', title: 'From the blog', count: 3 },
				{
					blockType: 'cta',
					heading: 'Ready to start?',
					text: 'Tell us about your project. We reply within two working days.',
					buttonLabel: 'Meet the team',
					buttonHref: '/about',
				},
			],
			seo: { metaTitle: 'Home', metaDescription: 'A small studio for careful work.' },
		},
	});
	const about = await ensure('pages', {
		where: bySlug('about'),
		data: {
			title: 'About',
			slug: 'about',
			sections: [
				{
					blockType: 'richText',
					body: doc(
						h(1, 'About us'),
						p('We are a small team that believes good work comes from listening first.'),
						p(
							'Since the beginning we have worked with local businesses, ',
							bold('one project at a time'),
							'.',
						),
					),
				},
				{ blockType: 'teamGrid', title: 'The team' },
			],
			seo: { metaTitle: 'About', metaDescription: 'Who we are and how we work.' },
		},
	});

	// Site settings (a draft-enabled global: this publishes it)
	await ensureGlobal('site', {
		siteName: 'My site',
		tagline: 'A small studio for careful work.',
		nav: [
			{ label: 'Home', page: home.id },
			{ label: 'About', page: about.id },
			{ label: 'Blog', href: '/blog' },
		],
		footer: {
			text: 'Built with kitcms on Cloudflare Workers.',
			social: [
				{ label: 'GitHub', url: 'https://github.com' },
				{ label: 'Email', url: 'mailto:hello@example.com' },
			],
		},
	});
	log('Seed done. Open /admin to edit it, and replace the example text.');
});
