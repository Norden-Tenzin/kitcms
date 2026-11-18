// Cloudflare Image Transformations URLs (https://developers.cloudflare.com/images/transform-images/).
// `/cdn-cgi/image/<options>/<source>` resizes and re-encodes on the fly (avif/webp via `format=auto`).
// It needs a zone with Image Transformations enabled, so it does nothing in dev, on *.workers.dev
// or for URLs it can't transform.

export interface ImageOptions {
	width?: number;
	height?: number;
	fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
	quality?: number;
}

/**
 * @param enabled Pass false in dev and on *.workers.dev (see `Img.svelte`): the URL is returned unchanged.
 */
export function imageUrl(url: string, options: ImageOptions = {}, enabled = true): string {
	if (!enabled) return url;
	const absolute = /^https:\/\//i.test(url);
	const rootRelative = url.startsWith('/') && !url.startsWith('//');
	if (!absolute && !rootRelative) return url;
	// SVG is vector already, and the transformer would only rasterize it.
	if (/\.svg(\?|$)/i.test(url)) return url;
	const parts = ['format=auto'];
	if (options.width) parts.push(`width=${Math.round(options.width)}`);
	if (options.height) parts.push(`height=${Math.round(options.height)}`);
	if (options.fit) parts.push(`fit=${options.fit}`);
	if (options.quality) parts.push(`quality=${Math.round(options.quality)}`);
	return `/cdn-cgi/image/${parts.join(',')}${rootRelative ? '' : '/'}${url}`;
}
