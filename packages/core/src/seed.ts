// `defineSeed` and the seed helpers (plan §13.3). Pure and Workers-safe: the Node-only runner that
// feeds them a Local API lives in `cli/seed.ts`.
import type { Cms, DocOf, GlobalDocOf, GlobalInputOf, InputOf, LocalAPI } from './api/types';
import type { CollectionSlug, Config, GlobalSlug, RegisteredConfig } from './config/collection';
import type { Where } from './config/where';

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
	log(message: string): void;
}

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
	};
	return { ctx: ctx as unknown as SeedContext<C>, stats };
}
