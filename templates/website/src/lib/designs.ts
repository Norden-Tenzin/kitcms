// The design registry: the one place that lists page types and their designs.
// - `kitcms.config.ts` builds the `site` Design tab and the per-page `design` selects from it.
// - The site picks a design with `resolveDesign(type, site.design, page.design)`.
// To add a design to a page type, add `d: 'Name'` to its `designs` below and handle `'d'` in the
// components that switch on it. Client-safe: no config imports, no server code.

export interface PageTypeDef {
	label: string;
	/** `id -> human name`. The first entry is the default. */
	designs: Record<string, string>;
}

export const PAGE_TYPES = {
	header: { label: 'Header', designs: { a: 'Bar', b: 'Centred', c: 'Band' } },
	footer: { label: 'Footer', designs: { a: 'Simple', b: 'Columns', c: 'Statement' } },
	home: { label: 'Home', designs: { a: 'Editorial', b: 'Immersive', c: 'Structured' } },
	page: { label: 'Page', designs: { a: 'Editorial', b: 'Immersive', c: 'Structured' } },
	blog: { label: 'Blog list', designs: { a: 'Journal', b: 'Cards', c: 'Index' } },
	post: { label: 'Blog post', designs: { a: 'Essay', b: 'Feature', c: 'Article' } },
} as const satisfies Record<string, PageTypeDef>;

export type PageType = keyof typeof PAGE_TYPES;
export type DesignId = 'a' | 'b' | 'c';

const defs = (type: PageType) => PAGE_TYPES[type].designs as Record<string, string>;

/** `{ label, value }` options for a select field. Select values can't be empty, so an unset page override means "use the site setting". */
export function designOptions(type: PageType) {
	return Object.entries(defs(type)).map(([value, name]) => ({
		label: `${value.toUpperCase()} · ${name}`,
		value,
	}));
}

/**
 * The design to render: the page's own override, else the `site` Design tab, else the type's first
 * design. Unknown ids (a design removed from the registry) fall back too.
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

// ---- Theme overrides ------------------------------------------------------------------------

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

function luminance(hex: string): number {
	const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join('') : hex.slice(1);
	const [r, g, b] = [0, 2, 4].map((i) => {
		const c = parseInt(h.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/**
 * The `site.theme` colours as an inline `style` for the `.site` element. Validated here again
 * (not only in the config), because the value ends up in CSS: anything that is not a hex colour
 * is dropped. Text on the accent (`--accent-ink`) is picked for contrast.
 */
export function themeStyle(
	theme?: { accent?: string | null; background?: string | null; text?: string | null } | null,
): string {
	const out: string[] = [];
	if (isHex(theme?.accent)) {
		out.push(`--accent:${theme.accent}`);
		out.push(`--accent-ink:${luminance(theme.accent) > 0.179 ? '#111111' : '#ffffff'}`);
	}
	if (isHex(theme?.background)) out.push(`--bg:${theme.background}`);
	if (isHex(theme?.text)) out.push(`--ink:${theme.text}`);
	return out.join(';');
}
