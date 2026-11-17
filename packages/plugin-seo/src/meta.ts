export interface MetaDefaults {
	siteName?: string;
	/** e.g. `'%s | Site'` */
	titleTemplate?: string;
	description?: string;
	/** Fallback image URL. */
	image?: string;
	/** Name of the meta group field. Default `'meta'`. */
	fieldName?: string;
	/** Document field used when `meta.title` is empty. Default `'title'`. */
	fallbackTitleField?: string;
}

export interface ResolvedMeta {
	title: string;
	description: string | null;
	image: string | null;
	robots: 'index, follow' | 'noindex, nofollow';
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Resolve the SEO fields of a document into final head values. Pure and defensive: never throws. */
export function getMeta(doc: unknown, defaults: MetaDefaults = {}): ResolvedMeta {
	const d: MetaDefaults = isRecord(defaults) ? defaults : {};
	const root = isRecord(doc) ? doc : {};
	const rawMeta = root[d.fieldName ?? 'meta'];
	const meta = isRecord(rawMeta) ? rawMeta : {};
	const siteName = str(d.siteName);

	let title = str(meta.title) || str(root[d.fallbackTitleField ?? 'title']) || siteName;
	const template = typeof d.titleTemplate === 'string' ? d.titleTemplate : '';
	if (template && title && title !== siteName) title = template.replaceAll('%s', title);

	const image = isRecord(meta.image) && typeof meta.image.url === 'string' && meta.image.url
		? meta.image.url
		: str(d.image) || null;

	return {
		title,
		description: str(meta.description) || str(d.description) || null,
		image,
		robots: meta.noIndex === true ? 'noindex, nofollow' : 'index, follow',
	};
}
