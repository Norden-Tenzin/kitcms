// The design registry: THE source of truth for page types and their designs (Decision 36).
// - `kitcms.config.ts` builds the `site` Design tab and the per-page `design` selects from it.
// - The site resolves a design with `resolveDesign(type, siteDesign, pageOverride)`.
// To add a design to a page type: add `d: 'Name'` to its `designs` below (and its component), nothing
// else. To add a page type: add an entry here, then a `site.design.<type>` field is generated for it.
// Client-safe: no config imports, no server code.

export const DESIGN_IDS = ['a', 'b', 'c'] as const;
/** Design ids are single letters; a page type can have more than three (`d`, `e`, ...) if listed. */
export type DesignId = string;

export interface PageTypeDef {
	label: string;
	/** `id -> human name`. The first entry is the default. */
	designs: Record<string, string>;
	/** The composition idea per design, for the admin hint and DESIGN.md. */
	notes?: Record<string, string>;
}

export const PAGE_TYPES = {
	header: {
		label: 'Header',
		designs: { a: 'Bar', b: 'Centred', c: 'Overlay' },
		notes: { a: 'Classic bar, logo left', b: 'Logo centred, links split either side', c: 'Transparent over the hero, minimal' },
	},
	footer: {
		label: 'Footer',
		designs: { a: 'Hearth', b: 'Directory', c: 'Signboard' },
		notes: { a: 'Two columns, calm', b: 'Four-column directory', c: 'The name at full width' },
	},
	home: {
		label: 'Home',
		designs: { a: 'Courtyard', b: 'Panorama', c: 'Ledger' },
		notes: {
			a: 'Editorial: pictures at uneven sizes on a grid',
			b: 'Immersive: full-bleed photographs, few words',
			c: 'Structured: a fixed photograph beside a scrolling column',
		},
	},
	page: {
		label: 'Page',
		designs: { a: 'Notebook', b: 'Vista', c: 'Index' },
	},
	rooms: {
		label: 'Rooms',
		designs: { a: 'Salon', b: 'Orchard', c: 'Compare' },
		notes: { a: 'Alternating editorial rows', b: 'Card grid with filters', c: 'Comparison table' },
	},
	room: {
		label: 'Room',
		designs: { a: 'Threshold', b: 'Window', c: 'Plan' },
		notes: { a: 'Editorial with a gallery strip', b: 'Full-bleed cover, facts over it', c: 'Datasheet with a sticky booking panel' },
	},
	experiences: {
		label: 'Experiences',
		designs: { a: 'Trails', b: 'Postcards', c: 'Itinerary' },
	},
	experience: {
		label: 'Experience',
		designs: { a: 'Journey', b: 'Summit', c: 'Day sheet' },
	},
	journal: {
		label: 'Journal',
		designs: { a: 'Field notes', b: 'Cover story', c: 'Archive' },
	},
	post: {
		label: 'Journal post',
		designs: { a: 'Essay', b: 'Feature', c: 'Letter' },
	},
	gallery: {
		label: 'Gallery',
		designs: { a: 'Wall', b: 'Reel', c: 'Contact sheet' },
	},
	dining: {
		label: 'Dining',
		designs: { a: 'Menu card', b: 'Kitchen', c: 'Table' },
	},
	contact: {
		label: 'Contact',
		designs: { a: 'Visit', b: 'Postcard', c: 'Directions' },
	},
} as const satisfies Record<string, PageTypeDef>;

export type PageType = keyof typeof PAGE_TYPES;
export const PAGE_TYPE_KEYS = Object.keys(PAGE_TYPES) as PageType[];

/** `{ label, value }` options for a select field. (Select values can't be empty: an unset override means "use the site setting".) */
export function designOptions(type: PageType) {
	const defs = PAGE_TYPES[type].designs as Record<string, string>;
	const options = Object.entries(defs).map(([value, name]) => ({
		label: `${value.toUpperCase()} · ${name}`,
		value,
	}));
	return options;
}

export function defaultDesign(type: PageType): DesignId {
	return Object.keys(PAGE_TYPES[type].designs)[0] ?? 'a';
}

/**
 * The design to render: the page's own override, else the `site` Design tab, else the type's
 * first design. Unknown ids (a design removed from the registry) fall back too.
 */
export function resolveDesign(
	type: PageType,
	siteDesign?: Partial<Record<string, string | null>> | null,
	override?: string | null,
): DesignId {
	const known = PAGE_TYPES[type].designs as Record<string, string>;
	for (const id of [override, siteDesign?.[type]]) if (id && id in known) return id;
	return defaultDesign(type);
}

export function designName(type: PageType, id: DesignId): string {
	return (PAGE_TYPES[type].designs as Record<string, string>)[id] ?? id;
}
