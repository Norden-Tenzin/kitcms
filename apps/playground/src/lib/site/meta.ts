// Reads the SEO plugin's `meta` group (added at runtime by `seo({ collections })`, so it is not in
// the generated document types). Never throws.
import { asMedia, type Media } from './media';

export interface DocMeta {
	title: string;
	description: string;
	image: Media | null;
	noIndex: boolean;
}

export function metaOf(doc: unknown): DocMeta {
	const raw = (doc as { meta?: unknown } | null)?.meta;
	const m = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
	const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
	return { title: str(m.title), description: str(m.description), image: asMedia(m.image), noIndex: m.noIndex === true };
}
