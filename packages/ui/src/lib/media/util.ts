// Shared helpers for the media library grid and the media picker.

/**
 * Thumbnail URL for a stored file. For now this returns the original URL.
 * TODO(Phase 2): decide on Cloudflare Image Transformations and return
 * `/cdn-cgi/image/width=${width},fit=cover,format=auto/${url}` here.
 */
export function thumbUrl(url: string, width: number): string {
	void width;
	return url;
}

export function formatSize(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function isImageMime(mime: unknown): boolean {
	return typeof mime === 'string' && mime.startsWith('image/');
}

/** Short file-type label shown on non-image tiles. */
export function fileLabel(mime: unknown, filename: unknown): string {
	if (typeof filename === 'string' && filename.includes('.')) return filename.split('.').pop()!.slice(0, 5).toUpperCase();
	if (typeof mime === 'string' && mime.includes('/')) return mime.split('/')[1]!.slice(0, 5).toUpperCase();
	return 'FILE';
}

export function metaLine(input: object): string {
	const doc = input as { filesize?: unknown; width?: unknown; height?: unknown };
	const parts: string[] = [];
	if (typeof doc.filesize === 'number') parts.push(formatSize(doc.filesize));
	if (typeof doc.width === 'number' && typeof doc.height === 'number') parts.push(`${doc.width}×${doc.height}`);
	return parts.join(' · ');
}
