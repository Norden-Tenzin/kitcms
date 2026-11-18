// Injectable runtime dependencies. INTERNAL: used by tests, not part of the documented API.
export interface Deps {
	fetch: typeof fetch;
	/** Reads a Worker secret/var by name. */
	getEnv: (name: string) => Promise<string | undefined>;
	/** Hands work to the runtime to finish after the response. Resolves `false` when unsupported. */
	waitUntil: (p: Promise<unknown>) => Promise<boolean>;
}

export const deps: Deps = {
	fetch: (input, init) => fetch(input, init),
	async getEnv(name) {
		const { env } = await import('cloudflare:workers');
		const v = (env as unknown as Record<string, unknown>)[name];
		return typeof v === 'string' ? v : undefined;
	},
	async waitUntil(p) {
		try {
			const mod = (await import('cloudflare:workers')) as { waitUntil?: (p: Promise<unknown>) => void };
			if (typeof mod.waitUntil !== 'function') return false;
			mod.waitUntil(p);
			return true;
		} catch {
			return false;
		}
	},
};

/** Test-only: replaces parts of the dependencies; returns a function that restores them. */
export function __setDeps(patch: Partial<Deps>): () => void {
	const prev = { ...deps };
	Object.assign(deps, patch);
	return () => Object.assign(deps, prev);
}
