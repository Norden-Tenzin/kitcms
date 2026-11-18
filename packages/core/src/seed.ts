// `defineSeed` and the seed helpers (plan §13.3). Pure and Workers-safe: the Node-only runner that
// feeds them a Local API lives in `cli/seed.ts`.
import type { Cms, DocOf, GlobalDocOf, GlobalInputOf, InputOf, LocalAPI } from './api/types';
import type { CollectionSlug, Config, GlobalSlug, RegisteredConfig } from './config/collection';
import type { Where } from './config/where';
import { markUploadWrite } from './access/engine';
import type { KitcmsReq } from './config/hooks';
import type { SanitizedConfig } from './config/sanitized';
import type { StorageAdapter } from './storage/adapter';
import { ulid } from './ulid';
import { detectMime, makeKey, mimeAllowed, parseDimensions } from './upload/sniff';

export interface SeedContext<C extends Config = RegisteredConfig> {
	/**
	 * The Local API acting as the system: EVERY call runs with `overrideAccess: true` (source
	 * `local`, no user), so locked collections and access rules never get in the way.
	 */
	cms: LocalAPI<C>;
	/**
	 * Creates `data` only when no document matches `where`. Returns the existing or created
	 * document. Idempotent; never overwrites what editors changed.
	 */
	ensure<S extends CollectionSlug<C>>(
		collection: S,
		args: { where: Where<DocOf<C, S>>; data: InputOf<C, S> },
	): Promise<DocOf<C, S>>;
	/** Writes `data` only when the global has never been saved. Returns the stored global. */
	ensureGlobal<S extends GlobalSlug<C>>(slug: S, data: Partial<GlobalInputOf<C, S>>): Promise<GlobalDocOf<C, S>>;
	/**
	 * Uploads a file into an upload collection (R2 + document) only when no document matches
	 * `where`. `file` is a path relative to the app root (`kitcms seed` reads it) or the bytes.
	 * The upload collection's `mimeTypes` and `maxFileSize` apply. Returns the existing or created document.
	 */
	ensureUpload<S extends CollectionSlug<C>>(
		collection: S,
		args: {
			where: Where<DocOf<C, S>>;
			file: string | { bytes: Uint8Array | ArrayBuffer; filename: string; mimeType?: string };
			data?: Partial<InputOf<C, S>>;
		},
	): Promise<DocOf<C, S>>;
	log(message: string): void;
}

/** What `ensureUpload` needs from the host (the CLI): the sanitized config, R2, and file reading. */
export interface SeedUploadDeps {
	config: SanitizedConfig;
	storage?: StorageAdapter;
	readFile?: (path: string) => Promise<Uint8Array>;
}

const EXT_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	avif: 'image/avif',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	pdf: 'application/pdf',
	mp4: 'video/mp4',
	webm: 'video/webm',
};

export type SeedFn<C extends Config = RegisteredConfig> = (ctx: SeedContext<C>) => void | Promise<void>;

/** Declares the seed: `export default defineSeed(async ({ cms, ensure, ensureGlobal, log }) => { ... })`. */
export function defineSeed<C extends Config = RegisteredConfig>(fn: SeedFn<C>): SeedFn<C> {
	return fn;
}

/** Created / already-present counts per collection (globals are keyed `global:<slug>`). */
export type SeedStats = Record<string, { created: number; present: number }>;

/** Index of the options argument per Local API method. */
const OPTIONS_AT: Record<string, number> = {
	find: 1,
	findOne: 1,
	count: 1,
	findByID: 2,
	create: 2,
	update: 3,
	move: 3,
	delete: 2,
	unpublish: 2,
	findVersions: 2,
	findVersionByID: 2,
	restoreVersion: 1,
	findGlobal: 1,
	updateGlobal: 2,
	findGlobalVersions: 1,
	restoreGlobalVersion: 1,
};

/** Wraps a Local API so every call carries `overrideAccess: true` and callers can't forget it. */
export function withSystemAccess(cms: Cms): Cms {
	return new Proxy(cms, {
		get(target, prop, receiver) {
			const value: unknown = Reflect.get(target, prop, receiver);
			if (typeof value !== 'function') return value;
			const at = typeof prop === 'string' ? OPTIONS_AT[prop] : undefined;
			if (at === undefined) {
				throw new Error(`kitcms seed: cms.${String(prop)} is not available in seeds.`);
			}
			return (...args: unknown[]) => {
				while (args.length <= at) args.push(undefined);
				const options = args[at];
				args[at] = {
					...(typeof options === 'object' && options !== null ? options : {}),
					overrideAccess: true,
				};
				return (value as (...a: unknown[]) => unknown).apply(target, args);
			};
		},
	});
}

/** Builds the context handed to a seed function, plus the stats it fills in. */
export function createSeedContext<C extends Config = Config>(
	localApi: Cms,
	log: (message: string) => void = () => {},
	uploads?: SeedUploadDeps,
): { ctx: SeedContext<C>; stats: SeedStats } {
	const cms = withSystemAccess(localApi);
	const stats: SeedStats = {};
	const bump = (key: string, field: 'created' | 'present') => {
		const entry = (stats[key] ??= { created: 0, present: 0 });
		entry[field]++;
	};
	const ctx: SeedContext<Config> = {
		cms,
		log,
		async ensure(collection, { where, data }) {
			const existing = await cms.findOne(collection, { where: where as never });
			if (existing) {
				bump(collection, 'present');
				return existing as never;
			}
			const created = await cms.create(collection, data as never);
			bump(collection, 'created');
			return created as never;
		},
		async ensureGlobal(slug, data) {
			const current = (await cms.findGlobal(slug)) as { createdAt?: string };
			// An unsaved global is returned as static defaults, without timestamps (§13.1).
			if (current.createdAt) {
				bump(`global:${slug}`, 'present');
				return current as never;
			}
			const saved = await cms.updateGlobal(slug, data as never);
			bump(`global:${slug}`, 'created');
			return saved as never;
		},
		async ensureUpload(collection, { where, file, data }) {
			const existing = await cms.findOne(collection, { where: where as never });
			if (existing) {
				bump(collection, 'present');
				return existing as never;
			}
			const col = uploads?.config.collectionsBySlug[collection];
			if (!col?.upload) throw new Error(`kitcms seed: "${collection}" is not an upload collection.`);
			const storage = uploads?.storage;
			if (!storage) throw new Error(`kitcms seed: ensureUpload needs the R2 binding "${uploads?.config.bindings.bucket}".`);
			let bytes: Uint8Array;
			let filename: string;
			let declared = '';
			if (typeof file === 'string') {
				if (!uploads?.readFile) throw new Error('kitcms seed: reading files by path is only available in `kitcms seed`.');
				bytes = await uploads.readFile(file);
				filename = file.split(/[\\/]/).pop() || 'file';
			} else {
				bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
				filename = file.filename;
				declared = file.mimeType ?? '';
			}
			const ext = filename.split('.').pop()?.toLowerCase() ?? '';
			const head = bytes.subarray(0, 64 * 1024);
			const mimeType = detectMime(head, declared || EXT_TYPES[ext] || '');
			if (!mimeAllowed(mimeType, col.upload.mimeTypes)) {
				throw new Error(`kitcms seed: ${filename} (${mimeType}) is not allowed in "${collection}".`);
			}
			if (bytes.byteLength > col.upload.maxFileSize) {
				throw new Error(`kitcms seed: ${filename} is larger than ${col.upload.maxFileSize} bytes.`);
			}
			const dims = parseDimensions(head, mimeType);
			const key = makeKey(ulid(), filename);
			const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
			await storage.put(key, body, { contentType: mimeType, size: bytes.byteLength });
			const req: KitcmsReq = { user: null, context: {}, cms: localApi, source: 'local' };
			markUploadWrite(req);
			try {
				const created = await cms.create(
					collection,
					{
						...(data as Record<string, unknown> | undefined),
						filename: filename.slice(0, 255),
						mimeType,
						filesize: bytes.byteLength,
						width: dims?.width ?? null,
						height: dims?.height ?? null,
						key,
					} as never,
					{ req } as never,
				);
				bump(collection, 'created');
				return created as never;
			} catch (err) {
				await storage.delete(key).catch(() => {});
				throw err;
			}
		},
	};
	return { ctx: ctx as unknown as SeedContext<C>, stats };
}
