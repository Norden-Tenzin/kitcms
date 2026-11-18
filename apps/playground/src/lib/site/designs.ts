// The design registry for the Halden Studio playground: every page type and its designs.
// - `kitcms.config.ts` builds the `site` Design tab and the per-page `design` selects from it.
// - The site picks a design with `resolveDesign(type, site.design, doc.design)`.
// Client-safe: no config imports, no server code.

export interface PageTypeDef {
	label: string;
	/** `id -> human name`. The first entry is the default. */
	designs: Record<string, string>;
}

export const PAGE_TYPES = {
	header: { label: 'Header', designs: { a: 'Bar', b: 'Split', c: 'Floating' } },
	footer: { label: 'Footer', designs: { a: 'Simple', b: 'Columns', c: 'Statement' } },
	home: { label: 'Home', designs: { a: 'Editorial', b: 'Showcase', c: 'Studio index' } },
	page: { label: 'Page', designs: { a: 'Editorial', b: 'Immersive', c: 'Structured' } },
	services: { label: 'Services', designs: { a: 'List', b: 'Cards', c: 'Steps' } },
	work: { label: 'Work list', designs: { a: 'Grid', b: 'Large rows', c: 'Index' } },
	project: { label: 'Project', designs: { a: 'Case study', b: 'Gallery first', c: 'Fact sheet' } },
	blog: { label: 'Blog list', designs: { a: 'Journal', b: 'Cards', c: 'Index' } },
	post: { label: 'Blog post', designs: { a: 'Essay', b: 'Feature', c: 'Article' } },
	contact: { label: 'Contact', designs: { a: 'Form first', b: 'Split', c: 'Directory' } },
} as const satisfies Record<string, PageTypeDef>;

export type PageType = keyof typeof PAGE_TYPES;
export type DesignId = 'a' | 'b' | 'c';

const defs = (type: PageType) => PAGE_TYPES[type].designs as Record<string, string>;

/** `{ label, value }` options for a select field. Select values can't be empty, so an unset override means "use the site setting". */
export function designOptions(type: PageType) {
	return Object.entries(defs(type)).map(([value, name]) => ({
		label: `${value.toUpperCase()} · ${name}`,
		value,
	}));
}

/**
 * The design to render: the document's own override, else the `site` Design tab, else the type's
 * first design. Unknown ids (a design removed from the registry) fall back too.
 */
export function resolveDesign(
	type: PageType,
	siteDesign?: Partial<Record<string, string | null>> | null,
	override?: string | null,
): DesignId {
	const known = defs(type);
	for (const id of [override, siteDesign?.[type]]) if (id && id in known) return id as DesignId;
	return Object.keys(known)[0] as DesignId;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);
