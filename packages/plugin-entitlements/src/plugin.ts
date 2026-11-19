import type {
	CollectionDef,
	Config,
	EntitlementsProvider,
	KitcmsPlugin,
	PanelBlock,
} from '@kitcms/core';
import { ForbiddenError, resolveValue, type Resolvable } from '@kitcms/core';
import { parseEntitlements, type Entitlements } from './parse';

export interface EntitlementsOptions {
	/** Worker var/secret holding the JSON. Default 'KITCMS_ENTITLEMENTS'. */
	variable?: string;
	/** Override how the raw value is read (tests). Default: lazy `await import('cloudflare:workers')` -> env[variable]. */
	read?: () => unknown | Promise<unknown>;
	/** Known add-ons, so the panel can show locked ones too: `{ booking: { label: 'Booking', description? } }`. */
	addons?: Record<string, { label: string; description?: string }>;
	/** Shown as a "Manage plan" link in the panel (https only; core drops anything else). */
	manageUrl?: Resolvable<string | undefined>;
}

const DEFAULT_VARIABLE = 'KITCMS_ENTITLEMENTS';

/**
 * `req.context.kitcmsEntitlementsBypass = true` skips the document and upload limits for that
 * operation. For control-plane migrations and seeds that must not be refused. Hooks can't tell a
 * system call from a user call, so this explicit flag is the only escape hatch.
 */
export const BYPASS_CONTEXT_KEY = 'kitcmsEntitlementsBypass';

const fail = (msg: string): never => {
	throw new Error(`entitlements: ${msg}`);
};

// Core's error: the admin, REST, RPC and plugin endpoints map it to 403 with this message.
function limitError(message: string): Error {
	return new ForbiddenError(message);
}

interface Source {
	/** Parsed value for the current raw value (re-read on every call, parse cached per raw string). */
	get(): Promise<Entitlements>;
}

function createSource(options: EntitlementsOptions): Source {
	const variable = options.variable ?? DEFAULT_VARIABLE;
	const read =
		options.read ??
		(async () => {
			// Lazy: this module must also load where `cloudflare:workers` doesn't exist (tests, build tooling).
			const { env } = await import('cloudflare:workers');
			return (env as unknown as Record<string, unknown>)[variable];
		});
	// Cached per isolate, keyed by the raw string so a changed var is re-parsed.
	let cachedKey: string | undefined;
	let cached: Entitlements | undefined;
	return {
		async get() {
			let raw: unknown;
			try {
				raw = await read();
			} catch {
				return parseEntitlements(undefined); // fail closed
			}
			const key = typeof raw === 'string' ? raw : raw === undefined ? '' : safeStringify(raw);
			if (cached && cachedKey === key) return cached;
			cached = parseEntitlements(raw);
			cachedKey = key;
			return cached;
		},
	};
}

function safeStringify(v: unknown): string {
	try {
		return JSON.stringify(v) ?? '';
	} catch {
		return '';
	}
}

/** Builds the provider core calls for every gated check. Never throws. */
export function createProvider(options: EntitlementsOptions = {}): EntitlementsProvider & Source {
	const source = createSource(options);
	return {
		get: () => source.get(),
		async has(addon: string): Promise<boolean> {
			try {
				return (await source.get()).addons.includes(addon);
			} catch {
				return false;
			}
		},
	};
}

function formatBytes(n: number): string {
	if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)} MB`;
	if (n >= 1_000) return `${+(n / 1_000).toFixed(1)} KB`;
	return `${n} bytes`;
}

type AnyHook = (args: never) => unknown;
const toArray = <T>(h: T | T[] | undefined): T[] =>
	h === undefined ? [] : Array.isArray(h) ? h : [h];

/** Adds the add-on limit hooks in front of the collection's own `beforeChange` hooks. */
function withLimits(col: CollectionDef, source: Source): CollectionDef {
	if (col.auth) return col; // never throttle the auth collection (lock-out risk)

	const hook = async (args: {
		req: {
			context: Record<string, unknown>;
			cms: { count: (slug: never, a: unknown) => Promise<number> };
		};
		operation: string;
		data: Record<string, unknown>;
	}) => {
		if (args.req.context[BYPASS_CONTEXT_KEY] === true) return;
		const { limits } = await source.get();
		if (args.operation === 'create') {
			const max = limits.documents[col.slug];
			if (max !== undefined) {
				const used = await args.req.cms.count(col.slug as never, {
					overrideAccess: true,
					req: args.req,
				});
				if (used >= max)
					throw limitError(`Your plan allows ${max} "${col.slug}" documents. Upgrade to add more.`);
			}
		}
		if (col.upload && limits.uploadBytes !== null) {
			const size = args.data.filesize;
			if (typeof size === 'number' && size > limits.uploadBytes) {
				throw limitError(`Your plan allows files up to ${limits.uploadBytes} bytes.`);
			}
		}
	};

	const hooks = col.hooks ?? {};
	return {
		...col,
		hooks: {
			...hooks,
			beforeChange: [
				hook as unknown as AnyHook,
				...toArray(hooks.beforeChange as AnyHook | AnyHook[]),
			],
		},
	} as unknown as CollectionDef;
}

/**
 * Entitlements: reads the plan JSON from a Worker var, turns it into `config.entitlements`
 * (add-on gates, enforced by core) and enforces document and upload limits. Read-only: it adds no
 * collections, globals, endpoints or writes, so nothing in kitcms can edit the plan.
 */
export function entitlements(options: EntitlementsOptions = {}): KitcmsPlugin {
	const provider = createProvider(options);

	return {
		name: 'entitlements',
		config(config: Config): Config {
			if (config.entitlements !== undefined) {
				fail(
					'`config.entitlements` is already set. Only one entitlements provider may be configured.',
				);
			}
			const collections = (config.collections ?? []) as readonly CollectionDef[];
			return {
				...config,
				entitlements: provider,
				collections: collections.map((c) => withLimits(c, provider)),
			};
		},
		admin: {
			panels: [
				{
					id: 'plan',
					label: 'Plan & add-ons',
					async load({ cms, runtime }) {
						const ent = await provider.get();
						const blocks: PanelBlock[] = [
							{ type: 'heading', text: ent.valid ? `Plan: ${ent.plan}` : 'Plan unknown' },
						];
						if (!ent.valid) {
							blocks.push({
								type: 'text',
								tone: 'warning',
								text: 'No plan information found; paid add-ons are off.',
							});
						}

						const known = options.addons ?? {};
						const ids = [...new Set([...Object.keys(known), ...ent.addons])];
						if (ids.length) {
							blocks.push({ type: 'heading', text: 'Add-ons' });
							blocks.push({
								type: 'list',
								items: ids.map((id) => ({
									label: known[id]?.label ?? id,
									...(known[id]?.description ? { description: known[id].description } : {}),
									status: ent.addons.includes(id) ? ('on' as const) : ('locked' as const),
								})),
							});
						}

						const docs = Object.entries(ent.limits.documents);
						if (docs.length || ent.limits.uploadBytes !== null) {
							blocks.push({ type: 'heading', text: 'Limits' });
							for (const [slug, limit] of docs) {
								const used = await cms
									.count(slug as never, { overrideAccess: true } as never)
									.catch(() => 0);
								blocks.push({ type: 'meter', label: slug, used, limit, unit: 'documents' });
							}
							if (ent.limits.uploadBytes !== null) {
								// A per-file cap, not a quota, so there's no usage to meter.
								blocks.push({
									type: 'keyValue',
									items: [{ label: 'Largest upload', value: formatBytes(ent.limits.uploadBytes) }],
								});
							}
						}

						const manageUrl = options.manageUrl === undefined ? undefined : await resolveValue(options.manageUrl, runtime);
						if (manageUrl) blocks.push({ type: 'link', label: 'Manage plan', href: manageUrl });
						return { blocks };
					},
				},
			],
		},
	};
}
