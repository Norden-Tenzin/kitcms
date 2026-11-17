import { encodeKey, type StorageAdapter, type StoredObject } from './adapter';

export function createR2Adapter(
	bucket: R2Bucket,
	opts: { publicUrl?: string; base: () => string },
): StorageAdapter {
	return {
		async put(key, body, o) {
			await bucket.put(key, body as ReadableStream | ArrayBuffer, {
				httpMetadata: { contentType: o.contentType },
			});
		},
		async get(key, o) {
			const obj = await bucket.get(key, {
				range: o?.range,
				onlyIf: o?.onlyIf?.etagDoesNotMatch
					? { etagDoesNotMatch: o.onlyIf.etagDoesNotMatch }
					: undefined,
			} as R2GetOptions);
			if (!obj) return null;
			const body = 'body' in obj && obj.body ? (obj.body as ReadableStream<Uint8Array>) : null;
			let range: StoredObject['range'];
			const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
			if (r) {
				if (typeof r.suffix === 'number') {
					const length = Math.min(r.suffix, obj.size);
					range = { offset: obj.size - length, length };
				} else {
					const offset = r.offset ?? 0;
					range = { offset, length: r.length ?? obj.size - offset };
				}
			}
			return {
				body,
				size: obj.size,
				etag: obj.etag,
				httpEtag: obj.httpEtag,
				contentType: obj.httpMetadata?.contentType,
				uploaded: obj.uploaded,
				range,
			};
		},
		async delete(key) {
			await bucket.delete(key);
		},
		url(key) {
			const pub = opts.publicUrl?.replace(/\/+$/, '');
			return pub ? `${pub}/${encodeKey(key)}` : `${opts.base()}/api/media/${encodeKey(key)}`;
		},
	};
}
