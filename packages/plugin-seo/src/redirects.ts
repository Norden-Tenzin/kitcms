import type { CollectionDef } from '@kitcms/core';
import { collection, fields as f } from '@kitcms/core';
import { checkFrom, checkTo, createsLoop, normalizePath } from './paths';

export interface RedirectsOptions {
	collection?: string;
	/** Seconds the per-isolate cache is trusted. Default 60. */
	cacheTtl?: number;
}

type Row = Record<string, unknown>;
interface LooseCms {
	find(slug: string, args: Record<string, unknown>): Promise<{ docs: Row[] }>;
	findByID(slug: string, id: string, args?: Record<string, unknown>): Promise<Row | null>;
}
interface Req {
	cms: unknown;
}

export interface RedirectTarget {
	to: string;
	status: 301 | 302;
}

const PAGE = 1000;
export const MAX_REDIRECTS = 5000;
const FAILURE_TTL_MS = 10_000;

/** Every row of a collection (trusted read), up to `max`. `truncated` when there were more. */
export async function readAll(
	cms: unknown,
	slug: string,
	args: Record<string, unknown>,
	max: number,
): Promise<{ docs: Row[]; truncated: boolean }> {
	const docs: Row[] = [];
	for (let page = 1; docs.length < max; page++) {
		const res = await (cms as LooseCms).find(slug, { ...args, limit: PAGE, page, pagination: false });
		docs.push(...res.docs);
		if (res.docs.length < PAGE) return { docs, truncated: false };
	}
	return { docs: docs.slice(0, max), truncated: true };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The enabled redirects as `from -> { to, status }`. */
export async function loadRedirects(cms: unknown, slug: string): Promise<Map<string, RedirectTarget>> {
	const { docs, truncated } = await readAll(
		cms,
		slug,
		{ where: { enabled: { equals: true } }, overrideAccess: true, depth: 0, sort: 'createdAt' },
		MAX_REDIRECTS,
	);
	if (truncated) console.warn(`seo: more than ${MAX_REDIRECTS} redirects; the rest are ignored.`);
	const map = new Map<string, RedirectTarget>();
	for (const d of docs) {
		const from = normalizePath(str(d.from));
		const to = str(d.to);
		if (!from || !to || map.has(from)) continue;
		map.set(from, { to, status: d.type === '302' ? 302 : 301 });
	}
	return map;
}

/** A per-isolate cache of the enabled redirects with a TTL. Failures fail open (empty, short TTL). */
export function createRedirectCache(slug: string, ttlSeconds: number) {
	let value: Map<string, RedirectTarget> | null = null;
	let expires = 0;
	let loading: Promise<Map<string, RedirectTarget>> | null = null;
	let generation = 0;

	return {
		async get(cms: unknown): Promise<Map<string, RedirectTarget>> {
			if (value && Date.now() < expires) return value;
			if (!loading) {
				const gen = generation;
				loading = loadRedirects(cms, slug)
					.then((m) => {
						if (gen === generation) {
							value = m;
							expires = Date.now() + ttlSeconds * 1000;
						}
						return m;
					})
					.catch((err) => {
						console.warn('seo: could not load redirects', err);
						const empty = new Map<string, RedirectTarget>();
						if (gen === generation) {
							value = empty;
							expires = Date.now() + Math.min(FAILURE_TTL_MS, ttlSeconds * 1000);
						}
						return empty;
					})
					.finally(() => {
						loading = null;
					});
			}
			return loading;
		},
		/** Drop the cache of this isolate. Other isolates catch up within the TTL. */
		invalidate(): void {
			value = null;
			expires = 0;
			generation++;
			loading = null;
		},
	};
}

/** The collection the plugin adds. Validation lives on `to` because it needs the other fields. */
export function redirectsCollection(slug: string, invalidate: () => void): CollectionDef {
	const hooks = {
		beforeValidate: [
			({ data }: { data: Row }) => {
				const out: Row = { ...data };
				if (typeof data.from === 'string') out.from = normalizePath(data.from);
				if (typeof data.to === 'string') out.to = data.to.trim();
				return out;
			},
		],
		afterChange: [() => void invalidate()],
		afterDelete: [() => void invalidate()],
	};

	return collection({
		slug,
		labels: { singular: 'Redirect', plural: 'Redirects' },
		admin: {
			useAsTitle: 'from',
			defaultColumns: ['from', 'to', 'type', 'enabled'],
			listSearchableFields: ['from', 'to'],
			group: 'SEO',
			description: 'Send visitors from an old path to a new page or URL.',
		},
		hooks,
		fields: {
			from: f.text({
				required: true,
				unique: true,
				admin: { description: 'The old path, e.g. /old-page. Path only, no domain or query.' },
				validate: (value: string | null | undefined) => {
					if (!value) return undefined;
					return checkFrom(normalizePath(value));
				},
			}),
			to: f.text({
				required: true,
				admin: { description: 'A /path on this site, or a full https:// URL.' },
				validate: async (
					value: string | null | undefined,
					{ req, id, data }: { req: Req; id?: string; data: Row },
				) => {
					if (!value) return undefined;
					const to = value.trim();
					const bad = checkTo(to);
					if (bad !== true) return bad;
					const cms = req.cms as LooseCms;

					let from = typeof data.from === 'string' ? normalizePath(data.from) : '';
					let enabled = data.enabled;
					if ((!from || enabled === undefined) && id) {
						const original = await cms.findByID(slug, id, { overrideAccess: true, depth: 0 });
						if (!from) from = normalizePath(str(original?.from));
						if (enabled === undefined) enabled = original?.enabled;
					}
					if (!from) return undefined;
					if (enabled === false) return undefined;
					if (normalizePath(to) === from) return 'A redirect cannot point to itself.';

					const { docs } = await readAll(
						cms,
						slug,
						{ where: { enabled: { equals: true } }, overrideAccess: true, depth: 0 },
						MAX_REDIRECTS,
					);
					const map = new Map<string, string>();
					for (const d of docs) if (d.id !== id) map.set(normalizePath(str(d.from)), str(d.to));
					if (createsLoop(map, from, to)) return 'This redirect would create a loop.';
					return true;
				},
			}),
			type: f.select({ options: ['301', '302'], defaultValue: '301', required: true }),
			enabled: f.checkbox({ defaultValue: true }),
			note: f.textarea({ admin: { description: 'Why this redirect exists. Not shown to visitors.' } }),
		},
	} as never) as CollectionDef;
}

/**
 * The `Location` for a redirect: `/`-relative targets are prefixed with the app's base path, and the
 * request's query string is kept when the target has none. Returns `null` for an unusable target.
 */
export function locationFor(target: RedirectTarget, requestUrl: URL, base: string): string | null {
	try {
		const external = !target.to.startsWith('/');
		const u = external ? new URL(target.to) : new URL(base + target.to, requestUrl.origin);
		if (!u.search) u.search = requestUrl.search;
		return external ? u.href : u.pathname + u.search + u.hash;
	} catch {
		return null;
	}
}
