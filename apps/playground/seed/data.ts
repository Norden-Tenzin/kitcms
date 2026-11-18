// Seed content for Halden Studio, a fictional design studio in Bengaluru. Every client, person and
// address here is invented. Pictures are referenced by key from images.json.
import { h2, ol, quote, rt, ul } from './rt';

export const TEAM = [
	{
		name: 'Isha Rao',
		role: 'Founder and creative director',
		bio: 'Started the studio in 2017 after eight years in house at a publisher. Leads brand identity and signs off everything that leaves the studio.',
	},
	{
		name: 'Kabir Menon',
		role: 'Design lead, websites',
		bio: 'Designs and builds the sites. Writes the CSS himself and cares more about a page loading on a bad connection than about animation.',
	},
	{
		name: 'Sunita Gowda',
		role: 'Photographer',
		bio: 'Shoots products, interiors and the odd workshop. Prefers one window and a white card over a lighting kit.',
	},
	{
		name: 'Dev Shetty',
		role: 'Studio manager',
		bio: 'Keeps projects on schedule and invoices on time. The first person you will speak to, and the last.',
	},
];

export const TAGS = ['Practice', 'Branding', 'Websites', 'Photography', 'Typography'];

export const SERVICES = [
	{
		slug: 'brand-identity',
		title: 'Brand identity',
		icon: 'pen',
		priceFrom: 'From ₹1.5 lakh',
		cover: 'type-cases',
		summary:
			'A name, a mark, type and colour, and the rules to use them. Built to work on a shopfront and on a phone.',
		body: rt(
			'We start with what your business does and who it is for, then work backwards to a look that fits. A logo is the smallest part of it. What people remember is the type, the colour and the way things are laid out, so that is where most of our time goes.',
			'You get a guide that a printer, a developer and your own team can follow without calling us. It covers the logo in every form you will need, the colours with print and screen values, the typefaces with licences sorted, and examples of the identity at work on real material.',
			h2('Who it suits'),
			ul(
				'New businesses that need a first identity that will not need redoing in two years',
				'Established businesses whose material has grown inconsistent',
				'Product and food brands that need packaging as well as a logo',
			),
		),
		deliverables: [
			'Logo in every form, as vector files',
			'Colour palette with print and screen values',
			'Typeface selection with licences',
			'Brand guide, 24 to 40 pages',
			'Stationery and social templates',
			'One round of rollout support',
		],
		process: [
			{
				title: 'Listen',
				text: 'A half-day workshop and a written brief that you approve before we draw anything.',
			},
			{
				title: 'Explore',
				text: 'Three routes, drawn at a rough stage, each with a short written reason. You choose one.',
			},
			{
				title: 'Refine',
				text: 'Two rounds of changes on the chosen route. Type, colour and the logo come together here.',
			},
			{
				title: 'Hand over',
				text: 'Final files, the guide and a one-hour session with your team on how to use them.',
			},
		],
	},
	{
		slug: 'websites',
		title: 'Websites',
		icon: 'layout',
		priceFrom: 'From ₹2.5 lakh',
		cover: 'studio-desk',
		summary:
			'Fast, plain sites that you can edit yourself. Designed and built in-house, hosted on infrastructure that costs very little to run.',
		body: rt(
			'We design on the real thing in the browser as early as we can, so you see how it behaves on a phone before anyone argues about a mockup. Pages are small, images are sized for the screen that asks for them, and the site works on a slow connection.',
			'Content lives in a CMS built for your pages, with only the fields you need. A person on your team should be able to publish a new page without reading instructions.',
			h2('What we do not do'),
			ul(
				'Sliders and autoplay video on the first screen',
				'Pop-ups on arrival',
				'Locked-in hosting: the code is yours',
			),
		),
		deliverables: [
			'Design for phone, tablet and desktop',
			'Build with a content editor for your team',
			'Copy edit and image preparation',
			'Search and sharing metadata',
			'Contact and enquiry forms with spam protection',
			'Launch support and a 30-day fix period',
		],
		process: [
			{
				title: 'Plan',
				text: 'We list the pages and the one thing each must do, then agree the content you will provide.',
			},
			{
				title: 'Design',
				text: 'Key pages in the browser, reviewed on your phone, not on a slide.',
			},
			{
				title: 'Build',
				text: 'Weekly builds you can click through. Content goes in as it is ready.',
			},
			{
				title: 'Launch',
				text: 'Domain, redirects, analytics and a short training session for your editors.',
			},
		],
	},
	{
		slug: 'product-design',
		title: 'Product design',
		icon: 'compass',
		priceFrom: 'From ₹4 lakh',
		cover: 'desk-lamp',
		summary:
			'Physical products and their packaging, from first sketch to a file your maker can quote against.',
		body: rt(
			'We design objects that small manufacturers can actually make: lamps, ceramics, stationery, simple furniture. We work with your maker early, because the cheapest design change is the one made before tooling.',
			'Every project ends with a drawing pack, a prototype you can hold and a short note on what to change if the first batch sells out and you want to make a thousand.',
		),
		deliverables: [
			'Sketches and a chosen direction',
			'Dimensioned drawings for your maker',
			'One physical prototype',
			'Packaging dieline and artwork',
			'Material and finish specification',
			'Notes for scaling production',
		],
		process: [
			{
				title: 'Understand',
				text: 'Who buys it, what it costs to make, and what your maker is good at.',
			},
			{
				title: 'Sketch',
				text: 'Fast drawings and cardboard models. We throw most of them away together.',
			},
			{ title: 'Prototype', text: 'One made object, tested at home or in the shop for two weeks.' },
			{
				title: 'Specify',
				text: 'Drawings, finishes and packaging, checked with the maker before they are final.',
			},
		],
	},
	{
		slug: 'photography',
		title: 'Photography',
		icon: 'camera',
		priceFrom: 'From ₹60,000',
		cover: 'compact-camera',
		summary:
			'Product, interior and workshop photography with natural light and a plain background. Edited and delivered ready for web and print.',
		body: rt(
			'Most of what we shoot is small: ceramics, food, stationery, jewellery, and the rooms and workbenches they come from. We work with daylight and a few white cards, so the pictures look like the object and not like our lighting.',
			'You get a shot list agreed in advance, edited files at web and print sizes, and a short colour note so the pictures stay consistent when someone else adds to them later.',
		),
		deliverables: [
			'Shot list agreed before the day',
			'One full day on location or in our studio',
			'20 to 40 edited images',
			'Web and print sizes',
			'Colour and cropping notes',
			'Licence for web, print and packaging',
		],
		process: [
			{
				title: 'Plan',
				text: 'We agree the shot list and the usage, and look at your space or products in advance.',
			},
			{ title: 'Shoot', text: 'A full day, usually with you or a colleague present to direct.' },
			{
				title: 'Edit',
				text: 'Colour, cropping and retouching. A contact sheet for you to pick from within five days.',
			},
			{
				title: 'Deliver',
				text: 'Final files in a shared folder with a short note on how they were prepared.',
			},
		],
	},
];

export const TESTIMONIALS = [
	{
		key: 'tanager',
		quote:
			'They asked us what we would not do before they asked what we wanted. The label looks like us, and our roaster no longer apologises for it.',
		name: 'Meghna Pillai',
		role: 'Founder',
		company: 'Tanager Coffee Roasters',
	},
	{
		key: 'fernleaf',
		quote:
			'Sunita shot forty pieces in a day without moving a single thing twice. Customers now say the bowls look better in person, which was the aim.',
		name: 'Ramesh Iyer',
		role: 'Potter and owner',
		company: 'Fernleaf Ceramics',
	},
	{
		key: 'ostrich',
		quote:
			'Kabir built a site our editor can run alone. It has not needed a call to Halden since launch, which is what we paid for.',
		name: 'Farah Siddiqui',
		role: 'Managing editor',
		company: 'Ostrich Press',
	},
	{
		key: 'brightwell',
		quote:
			'The prototype arrived in week five and the drawings quoted correctly at three different workshops. Nobody had asked for that, but it saved us a month.',
		name: 'Nikhil Joshi',
		role: 'Director',
		company: 'Brightwell Lamps',
	},
	{
		key: 'lantern',
		quote:
			'Straight answers on price, on timelines and on what we should cut. We cut two pages and the new site converts better than the old one.',
		name: 'Dr. Anita Krishnan',
		role: 'Clinic director',
		company: 'Lantern Lane Dental',
	},
];

export const PROJECTS = [
	{
		title: 'Tanager Coffee Roasters',
		client: 'Tanager Coffee Roasters',
		year: 2024,
		featured: true,
		services: ['brand-identity', 'photography'],
		cover: 'type-tray',
		gallery: ['type-cases', 'studio-desk', 'pencil-leads', 'type-drawers'],
		testimonial: 'tanager',
		summary:
			'A small-batch roaster in Indiranagar wanted to look like a place that cares about the bean, not a place that sells coffee flavours.',
		facts: [
			{ label: 'Scope', value: 'Name check, identity, packaging, photography' },
			{ label: 'Timeline', value: '10 weeks' },
			{ label: 'Printed', value: '9 packaging sizes' },
			{ label: 'Team', value: 'Isha, Sunita' },
		],
		body: rt(
			'Tanager roasts eight single-origin coffees a month in a 12-kilo drum. The founders had a good product and a label drawn by a friend, with a bird that looked like three different birds depending on the pack.',
			h2('What we found'),
			'The roasters kept a notebook of every batch: date, origin, roast time, notes. We liked how plain it was. The identity takes its structure from that notebook: a tight monospaced date, a lowercase wordmark and one colour per origin region.',
			h2('What we made'),
			ul(
				'A wordmark and a small bird mark, drawn once and tested down to 8 mm',
				'A packaging system with nine sizes from one template',
				'A palette of six colours, one for each growing region',
				'Product and workshop photography for the website and the shelf',
			),
			quote('A label should tell you what is inside before you read it. The colour does that now.'),
			'The new packs went onto shelves in two stores in March. The founders tell us that repeat orders from the first batch of shops are above what they forecast.',
		),
	},
	{
		title: 'Mulberry Row',
		client: 'Mulberry Row Homes',
		year: 2024,
		featured: true,
		services: ['websites'],
		cover: 'skylight-spiral',
		gallery: ['spiral-stair', 'glasshouse', 'arched-door'],
		testimonial: null,
		summary:
			'A launch site for a 64-home development in Whitefield, built to run for a year on a very small hosting bill.',
		facts: [
			{ label: 'Scope', value: 'Site design, build, floor plan viewer' },
			{ label: 'Timeline', value: '7 weeks' },
			{ label: 'Homes', value: '64 in three buildings' },
			{ label: 'Page weight', value: 'Under 300 KB on the home page' },
		],
		body: rt(
			'Property sites tend to be heavy. Mulberry Row wanted something quick on a phone, because most of their enquiries come from people who find them at lunch on a bad connection.',
			h2('The plan viewer'),
			'The only complicated piece is the floor plan viewer. It is a single SVG per floor with the homes as clickable shapes, and it works without JavaScript for the list of units beside it.',
			'Photographs of the site arrive progressively as the build advances. Editors replace them from the CMS and the page picks up the new size automatically.',
		),
	},
	{
		title: 'Ostrich Press',
		client: 'Ostrich Press',
		year: 2023,
		featured: false,
		services: ['brand-identity', 'websites'],
		cover: 'type-specimen',
		gallery: ['type-drawers', 'type-cases'],
		testimonial: 'ostrich',
		summary:
			'An independent publisher of translated poetry with a catalogue of forty books and no consistent look.',
		facts: [
			{ label: 'Scope', value: 'Identity, book series template, website' },
			{ label: 'Timeline', value: '12 weeks' },
			{ label: 'Typefaces', value: 'One serif with Devanagari and Kannada companions' },
			{ label: 'Titles', value: '40 at launch' },
		],
		body: rt(
			'Ostrich publishes poems in Kannada, Hindi and English, often on facing pages. Setting the scripts together was the real design problem, not the logo.',
			'We chose one serif with matching Devanagari and Kannada, then tuned sizes and line spacing so the scripts sit at the same visual weight beside each other. The series template fixes those values, so new books inherit them.',
			'The website lists the whole catalogue with an excerpt for each title and lets the editor publish a new book in a few minutes.',
		),
	},
	{
		title: 'Fernleaf Ceramics',
		client: 'Fernleaf Ceramics',
		year: 2023,
		featured: true,
		services: ['photography', 'product-design'],
		cover: 'green-bowl',
		gallery: ['drafting-desk', 'drawing-instruments', 'studio-desk'],
		testimonial: 'fernleaf',
		summary:
			'Forty pieces photographed in a day for a potter who had been shooting on a phone in the kitchen.',
		facts: [
			{ label: 'Scope', value: 'Photography, packaging insert' },
			{ label: 'Shoot', value: 'One day, 40 pieces' },
			{ label: 'Delivered', value: '120 edited images' },
			{ label: 'Light', value: 'One north-facing window' },
		],
		body: rt(
			'Glazes are hard to photograph. A celadon bowl turns grey under yellow light and flat under a flash. We shot by one north-facing window with white cards, and matched every frame to the piece in the hand before moving on.',
			'We also designed a small card for each parcel, with care notes and a tiny drawing of the glaze recipe name.',
		),
	},
	{
		title: 'Lantern Lane Dental',
		client: 'Lantern Lane Dental',
		year: 2023,
		featured: false,
		services: ['websites'],
		cover: 'arched-door',
		gallery: ['cubbon-road', 'glasshouse'],
		testimonial: 'lantern',
		summary:
			'A five-clinic dental group needed one site with a booking form that people actually finish.',
		facts: [
			{ label: 'Scope', value: 'Site, booking form, clinic pages' },
			{ label: 'Timeline', value: '8 weeks' },
			{ label: 'Clinics', value: '5 across Bengaluru' },
			{ label: 'Form length', value: 'Four fields, down from eleven' },
		],
		body: rt(
			'The old booking form had eleven fields and a captcha puzzle. Fewer than one in five people finished it. We cut the form to name, number, clinic and a free-text field, and moved the rest to the call that follows.',
			'Each clinic has its own page with opening hours, a map link and the dentists who work there, kept in the CMS so the front desk can update them.',
		),
	},
	{
		title: 'Brightwell desk lamp',
		client: 'Brightwell Lamps',
		year: 2022,
		featured: true,
		services: ['product-design'],
		cover: 'desk-lamp',
		gallery: ['pencil-leads', 'drawing-instruments', 'drafting-desk'],
		testimonial: 'brightwell',
		summary:
			'A jointed task lamp for a Chennai workshop that makes steel furniture, designed to ship flat.',
		facts: [
			{ label: 'Scope', value: 'Product design, drawings, packaging' },
			{ label: 'Timeline', value: '14 weeks' },
			{ label: 'Parts', value: '11, all cut from one sheet size' },
			{ label: 'Pack', value: 'Flat, 6 cm deep' },
		],
		body: rt(
			'Brightwell’s workshop cuts steel on a laser and bends it on a press. We designed the lamp around those two machines, with two arms, a base and a shade that all come from the same sheet size.',
			ol(
				'Week 1 to 3: sketches and cardboard models, one chosen',
				'Week 4 to 8: steel prototypes and a spring test',
				'Week 9 to 14: drawings, packaging and a first batch of fifty',
			),
			'The lamp ships flat and goes together with a screwdriver in under five minutes.',
		),
	},
	{
		title: 'Paperkite',
		client: 'Paperkite Stationery',
		year: 2022,
		featured: false,
		services: ['brand-identity', 'websites'],
		cover: 'print-swatches',
		gallery: ['type-specimen', 'railing-colours'],
		testimonial: null,
		summary:
			'A stationery shop with a wide range and a loud personality, asking for an identity that could hold it all.',
		facts: [
			{ label: 'Scope', value: 'Identity, packaging, simple shop site' },
			{ label: 'Timeline', value: '9 weeks' },
			{ label: 'Palette', value: 'Twelve flat colours, used one at a time' },
		],
		body: rt(
			'Paperkite sells notebooks, pens and paper in more colours than most shops carry. The identity does not try to pick a favourite. It uses one colour at a time, chosen from the product, on an otherwise plain page.',
			'The site is a catalogue with a basket link to the owner’s existing payment page, built to be edited by two people at the shop counter.',
		),
	},
	{
		title: 'Northfield Film Co-op',
		client: 'Northfield Film Co-op',
		year: 2021,
		featured: false,
		services: ['photography', 'brand-identity'],
		cover: 'film-camera',
		gallery: ['compact-camera', 'railing-colours'],
		testimonial: null,
		summary:
			'A volunteer film lab and screening group that needed a poster system their members could use in a free tool.',
		facts: [
			{ label: 'Scope', value: 'Identity, poster templates, photography' },
			{ label: 'Timeline', value: '6 weeks' },
			{ label: 'Tools', value: 'Templates for a free layout app' },
		],
		body: rt(
			'The co-op has no designer and no budget for one after we leave. We built every poster as a template in a free tool, so members change the film name and the date and the poster stays within the identity.',
			'We also photographed the lab and the cameras it lends out, for the wall and the website.',
		),
	},
];

export const POSTS = [
	{
		title: 'How we scope a brand identity project',
		author: 'Isha Rao',
		date: '2026-10-21',
		tags: ['Practice', 'Branding'],
		cover: 'drafting-desk',
		excerpt:
			'Most identity projects go wrong in the first week, when nobody has agreed what finished looks like. Here is the one-page document we write before we draw.',
		body: rt(
			'Almost every project that has run over on us ran over because we did not agree what “done” meant at the start. A logo is easy to finish. An identity is not, because a printer, a developer or an intern will always find something it does not cover.',
			h2('The one-page scope'),
			'Before we draw anything we write a single page and ask you to sign it. It has five lines: what you do, who for, what the identity must be used on in the first year, what it does not need to do yet, and the number of review rounds.',
			h2('What goes in the “used on” list'),
			ul(
				'Anything with a deadline: a shopfront board, a packaging order, a launch event',
				'Anything your team will make without us: social posts, invoices, slide decks',
				'Anything a supplier will make: carton boxes, signage, uniforms',
			),
			'The things nobody has a date for are the things we leave out. A project that tries to cover a hypothetical second shop and a possible app is a project that never ends.',
			h2('Review rounds'),
			'Two rounds, on the route you chose. If a third is needed we say so and agree what it costs. This is not about money. A third round almost always means the brief was wrong, and the useful thing is to fix the brief.',
		),
	},
	{
		title: 'Writing a design brief that gets you what you want',
		author: 'Dev Shetty',
		date: '2026-09-30',
		tags: ['Practice'],
		cover: 'pencil-leads',
		excerpt:
			'A good brief is half a page and answers four questions. Most of the briefs we get answer one of them.',
		body: rt(
			'We read a lot of briefs. The best ones are short. The worst ones are long and say a great deal about the founder’s taste and very little about the customer.',
			h2('The four questions'),
			ol(
				'Who is this for, and where will they see it first?',
				'What should they do after seeing it?',
				'What have you already tried, and what happened?',
				'What can we not change: a name, a colour, a legal line, a date?',
			),
			'If you can answer those in a few sentences each, we can start. If you cannot, that is fine. Tell us which ones you cannot and we will help you work them out in the first workshop.',
			h2('What to leave out'),
			'Do not send us moodboards of other companies’ identities. They tell us what you admire, which we can ask about in person, and they tend to narrow what we will try. Do send photographs of your own products, shopfront and the places your customers meet you.',
		),
	},
	{
		title: 'What a website really costs, and why',
		author: 'Kabir Menon',
		date: '2026-09-08',
		tags: ['Websites', 'Practice'],
		cover: 'studio-desk',
		excerpt:
			'The price of a website is mostly the price of deciding what goes on it. A short guide to where the hours go.',
		body: rt(
			'People ask us for a price per page. It is the wrong unit. A page of text and a photograph takes an afternoon. A page that has to explain a complicated service, handle a form and work for three audiences takes a week.',
			h2('Where the hours go'),
			ul(
				'Deciding the content and structure: about a quarter of the project',
				'Design in the browser: about a quarter',
				'Build and the CMS: about a third',
				'Testing, fixes and launch: the rest',
			),
			'Notice what is not there. The design and the build are about half the time. The other half is the thinking before and the care after.',
			h2('The running cost'),
			'On the platform we build on, a typical studio or small business site costs less than the price of a coffee a month to host. The cost that surprises people is time: someone has to write the content and keep it current. We plan for that from the start.',
		),
	},
	{
		title: 'Photographing small objects with one window',
		author: 'Sunita Gowda',
		date: '2026-08-12',
		tags: ['Photography'],
		cover: 'green-bowl',
		excerpt:
			'You do not need a lighting kit to photograph a bowl, a notebook or a bottle. You need a window, two white cards and patience.',
		body: rt(
			'Daylight from one window is the most flattering light for small objects. It is soft on one side and falls off gently on the other, and it is free.',
			h2('The set'),
			ul(
				'A table pulled to a north- or south-facing window, not in direct sun',
				'A sheet of white paper that curves up behind the object',
				'A white card opposite the window to lift the shadows',
				'A tripod, or a stack of books and a steady hand',
			),
			h2('Three things that matter more than the camera'),
			'First, keep the object clean. Dust shows in every file. Second, shoot a little darker than you think, then lift the shadows in editing, so highlights keep their detail. Third, match the colour to the object in your hand, not to what the screen says.',
			'A phone is enough for a first catalogue. We bring a camera because our clients use the pictures on shelves and in print, but the light is the same.',
		),
	},
	{
		title: 'Choosing typefaces for Devanagari and Latin together',
		author: 'Isha Rao',
		date: '2026-07-14',
		tags: ['Typography', 'Branding'],
		cover: 'type-specimen',
		excerpt:
			'Mixing scripts on one page is a quiet problem that shows up in every Indian brand. Here is how we pick pairs that sit well.',
		body: rt(
			'When a sign or a website carries both Devanagari and Latin, the two scripts rarely have the same visual size. The same font size makes Devanagari look smaller, or Latin look heavier, depending on the pair.',
			h2('What to look at'),
			ul(
				'Stroke weight: set a line of each and squint. One should not dominate',
				'x-height against the headline bar: the shirorekha of Devanagari sits above the letters and takes space',
				'Line spacing: Devanagari needs more room for matras above and below',
			),
			'Most of the time the answer is to set Devanagari one or two points larger than the Latin beside it, and to give it a little more line height. This is easy to bake into a style guide, and very hard to explain afterwards.',
			h2('Start with a family'),
			'A type family that has both scripts designed together is a safer start than two unrelated faces. Several are available on open licences. Check the licence covers web use and embedding in apps, because this is the part that sometimes costs a surprise later.',
		),
	},
	{
		title: 'Why we say no to rush work',
		author: 'Isha Rao',
		date: '2026-06-02',
		tags: ['Practice'],
		cover: 'drawing-instruments',
		excerpt:
			'Every few months someone asks for an identity in a week. We say no, and this is the reasoning, so you can tell if it applies to you.',
		body: rt(
			'We are a small studio. If we say yes to a one-week job, we are saying no to the client who has been waiting for a slot since March. That is the least interesting reason.',
			'The better reason is that identity work needs a pause in the middle. We draw three routes, put them aside for a weekend and look again. The best idea is almost never the one we liked on Friday. A week does not have a weekend in it.',
			h2('What we do instead'),
			'If you have a hard date, tell us early. We can agree a smaller scope that fits: a name and a logo now, the full guide after the event. If the date comes from an event, a launch or a printer slot, we work back from it and tell you plainly what fits.',
			h2('When rush is fine'),
			'A poster, a single page, a set of social templates: those can be done in days. Say what you need and we will tell you honestly which kind of job it is.',
		),
	},
];

export const OFFERS = [
	{
		title: 'Brand starter',
		price: '₹1,20,000',
		summary:
			'A compact identity for a new business: logo, colour, type and a short guide. For businesses with one product or one shop.',
		includes: [
			'Logo in every form',
			'Palette and two typefaces',
			'12-page guide',
			'Stationery templates',
			'Two review rounds',
		],
		validTo: '2027-03-31',
		ctaLabel: 'Ask about this',
		ctaHref: '/contact?service=brand-identity',
	},
	{
		title: 'Website in six weeks',
		price: '₹2,40,000',
		summary:
			'A five-page site with an editor, built in six weeks from content you provide. Limited to two projects at a time.',
		includes: [
			'Home, about, services, work and contact pages',
			'A content editor for your team',
			'Enquiry form with spam protection',
			'Photography prep for up to 20 images',
			'30 days of fixes',
		],
		validTo: '2027-03-31',
		ctaLabel: 'Ask about this',
		ctaHref: '/contact?service=websites',
	},
];

export const LEGAL = {
	privacy: rt(
		'Halden Studio is a fictional design studio. This site is a demonstration of kitcms, so nothing you submit here is collected for a real business.',
		h2('What the forms do'),
		'When you send the project brief or the contact form, the demo stores your message in its own database so that a person using the admin can read it. Nothing is sent to any third party except the spam check on the form.',
		h2('Cookies'),
		'The public pages do not set tracking cookies. Signing in to the admin sets a session cookie so that you stay signed in.',
		h2('Your data'),
		'On the demo, the owner deletes submissions regularly. Please do not enter personal details you do not want stored.',
	),
	terms: rt(
		'These terms apply to this demonstration site only.',
		h2('Use of the site'),
		'The studio, its people, its clients and its work are made up. Photographs are openly licensed and credited on the credits page. You may look around and use the admin sandbox, but please do not try to break it.',
		h2('No warranty'),
		'The demo is provided as it is. Content may change or be reset at any time.',
	),
};

export const KITCHEN_SINK = [
	{
		title: 'Every field, filled',
		status: 'done',
		featured: true,
		due: '2026-12-01T00:00:00.000Z',
		summary: 'A sample that fills every field type so the /lab page has something to show.',
		email: 'lab@halden.example',
		count: 42,
		ratio: 0.618,
		website: 'https://example.com',
		doneNote: 'Finished and checked.',
		internalNote: 'Visible only when signed in.',
		body: rt(
			'This text sits in a rich text field. It can hold headings, lists and quotes.',
			ul('First item', 'Second item'),
		),
		settings: { theme: 'light', columns: 3, tags: ['a', 'b'] },
		address: { line: '12 Church Lane', row: { city: 'Bengaluru', postcode: '560001' } },
		links: [
			{ label: 'kitcms', href: 'https://kitcms.dev' },
			{ label: 'Example', href: 'https://example.com' },
		],
		advanced: { notes: 'A note in a collapsible group.', score: 7 },
	},
	{
		title: 'Just the basics',
		status: 'idea',
		featured: false,
		summary: 'A minimal sample: only the required field and a few simple ones.',
		count: 3,
		body: rt('A short rich text value.'),
	},
];

export const NOTES = [
	{
		title: 'Studio opening hours',
		visibility: 'public',
		body: 'Monday to Friday, ten to six. Closed on the second Saturday of each month.',
	},
	{
		title: 'How to book a call',
		visibility: 'public',
		body: 'Use the contact form and mention a time that suits you. Dev replies within a working day.',
	},
	{
		title: 'Pricing sheet (internal)',
		visibility: 'team',
		body: 'Day rates and the discount rules for repeat clients. Not for sharing outside the studio.',
	},
	{
		title: 'Client list for the audit',
		visibility: 'team',
		body: 'Contacts for the year-end check. Team only.',
	},
];
