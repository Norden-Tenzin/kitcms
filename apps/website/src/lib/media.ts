// Upload fields hold a media document when the read used `depth: 1`, and an id string otherwise
// (or when the target is not readable). These helpers narrow `unknown` to what the UI needs.

export interface Media {
	id: string;
	url: string;
	alt?: string | null;
	width?: number | null;
	height?: number | null;
	mimeType?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The media document, or null for ids, empty values and anything without a `url`. */
export function asMedia(value: unknown): Media | null {
	if (!isRecord(value) || typeof value.url !== 'string' || typeof value.id !== 'string')
		return null;
	return value as unknown as Media;
}

/** A `hasMany` upload field as media documents (ids are skipped). */
export function asMediaList(value: unknown): Media[] {
	return Array.isArray(value) ? value.map(asMedia).filter((m): m is Media => m !== null) : [];
}

/** A populated relationship document (`{ id, ... }`), or null for ids and empty values. */
export function asDoc<T extends { id: string }>(value: unknown): T | null {
	return isRecord(value) && typeof value.id === 'string' ? (value as unknown as T) : null;
}
