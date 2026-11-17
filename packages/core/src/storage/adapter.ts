// Internal file-storage interface (R2 is the only implementation). Runtime-agnostic types only.

export type ByteRange = { offset: number; length?: number } | { suffix: number };

export interface StoredObject {
	/** `null` when `onlyIf.etagDoesNotMatch` matched (not modified). */
	body: ReadableStream<Uint8Array> | null;
	size: number;
	etag: string;
	/** Quoted, ready for an `ETag` header. */
	httpEtag: string;
	contentType: string | undefined;
	uploaded: Date;
	/** The served byte range (inclusive offset, length), when a range was requested. */
	range?: { offset: number; length: number };
}

export interface StorageAdapter {
	put(
		key: string,
		body: ReadableStream | ArrayBuffer,
		opts: { contentType: string; size?: number },
	): Promise<void>;
	get(
		key: string,
		opts?: { range?: ByteRange; onlyIf?: { etagDoesNotMatch?: string } },
	): Promise<StoredObject | null>;
	delete(key: string): Promise<void>;
	/**
	 * Public URL of a key. With `media.publicUrl` set it is `${publicUrl}/${key}`; otherwise a
	 * relative `${base}/api/media/${key}` that only works for browsers on the app's own origin.
	 * Headless consumers (other Workers over RPC) must set `media.publicUrl`.
	 */
	url(key: string): string;
}

/** Encodes each path segment of a key. */
export function encodeKey(key: string): string {
	return key.split('/').map(encodeURIComponent).join('/');
}
