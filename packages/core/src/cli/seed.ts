/// <reference types="node" />
// Node only (build tooling). `kitcms seed [--remote]`: runs the app's seed file against the app's
// D1/R2, reached through wrangler's `getPlatformProxy` (local Miniflare state, or the real
// database with `--remote`).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { runnerImport } from 'vite';
import { createLocalApi } from '../api/local';
import type { Cms } from '../api/types';
import { dbFor, storageFor } from '../runtime';
import type { StorageAdapter } from '../storage/adapter';
import { createSeedContext, type SeedFn, type SeedStats } from '../seed';
import { findD1Binding } from './args';
import type { Ctx } from './commands';
import { CliError, loadConfig } from './load-config';

const WRANGLER_FILES = ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml'];
const SEED_CANDIDATES = ['src/kitcms.seed.ts', 'kitcms.seed.ts'] as const;

interface PlatformProxy {
	env: Record<string, unknown>;
	dispose(): Promise<void>;
}
type GetPlatformProxy = (options: {
	configPath?: string;
	persist?: boolean;
	remoteBindings?: boolean;
}) => Promise<PlatformProxy>;

export function resolveSeedPath(root: string, explicit?: string): string {
	if (explicit) {
		const p = path.resolve(root, explicit);
		if (!fs.existsSync(p)) throw new CliError(`seed file not found: ${p}`);
		return p;
	}
	for (const c of SEED_CANDIDATES) {
		const p = path.join(root, c);
		if (fs.existsSync(p)) return p;
	}
	throw new CliError(
		`no seed file found in ${root} (looked for ${SEED_CANDIDATES.join(', ')}). Create one with \`export default defineSeed(async ({ ensure }) => { ... })\` or use --seed <path>.`,
	);
}

/** Loads wrangler from the app (it is an optional peer dependency of @kitcms/core). */
async function loadWrangler(root: string): Promise<{ getPlatformProxy: GetPlatformProxy }> {
	let entry: string;
	try {
		entry = createRequire(path.join(root, 'package.json')).resolve('wrangler');
	} catch {
		throw new CliError('`kitcms seed` needs wrangler. Install it in your app: pnpm add -D wrangler');
	}
	// Native import: this file runs inside Vite's module runner, which is closed by now and would
	// reject (or try to transform) a dynamic `import()`.
	const nativeImport = new Function('url', 'return import(url)') as (url: string) => Promise<unknown>;
	const mod = (await nativeImport(pathToFileURL(entry).href)) as {
		getPlatformProxy?: GetPlatformProxy;
	};
	if (typeof mod.getPlatformProxy !== 'function') throw new CliError('the installed wrangler has no getPlatformProxy.');
	return { getPlatformProxy: mod.getPlatformProxy };
}

/** `--remote` needs the D1 binding to be marked `remote: true`, or wrangler would use local state. */
export function assertRemoteBinding(wranglerFile: string, text: string, binding: string): void {
	const d1 = findD1Binding(wranglerFile, text, binding);
	if (d1.status === 'found' && !d1.remote) {
		throw new CliError(
			`\`kitcms seed --remote\` needs the D1 binding "${binding}" to be remote-capable. Add "remote": true to its entry in ${wranglerFile} (d1_databases), or run without --remote to seed the local database.`,
		);
	}
	if (d1.status === 'no-binding') {
		throw new CliError(`${wranglerFile} has no d1_databases entry with binding "${binding}".`);
	}
}

export function formatStats(stats: SeedStats): string[] {
	const keys = Object.keys(stats).sort();
	if (keys.length === 0) return ['nothing to do (the seed used no ensure/ensureGlobal/ensureUpload)'];
	return keys.map((k) => `${k}: ${stats[k]!.created} created, ${stats[k]!.present} already present`);
}

export async function seed(ctx: Ctx): Promise<SeedStats> {
	const { config } = await loadConfig(ctx.root, ctx.configOption);
	const seedPath = resolveSeedPath(ctx.root, ctx.seed);

	const wranglerFile = WRANGLER_FILES.find((f) => fs.existsSync(path.join(ctx.root, f)));
	if (!wranglerFile) throw new CliError(`no wrangler config found in ${ctx.root} (wrangler.jsonc, wrangler.json or wrangler.toml).`);
	const wranglerPath = path.join(ctx.root, wranglerFile);
	if (ctx.remote) assertRemoteBinding(wranglerFile, fs.readFileSync(wranglerPath, 'utf8'), config.bindings.db);

	let mod: { default?: SeedFn };
	try {
		({ module: mod } = await runnerImport<{ default?: SeedFn }>(seedPath, {
			root: ctx.root,
			configFile: false,
			plugins: [svelte()],
			logLevel: 'warn',
		}));
	} catch (e) {
		throw new CliError(`failed to load ${seedPath}: ${(e as Error).message}`);
	}
	if (typeof mod.default !== 'function') {
		throw new CliError(`${seedPath} has no default export. Use \`export default defineSeed(async ({ ensure }) => { ... })\`.`);
	}

	const { getPlatformProxy } = await loadWrangler(ctx.root);
	ctx.log(`seeding the ${ctx.remote ? 'REMOTE' : 'local'} database (${config.bindings.db}) with ${path.relative(ctx.root, seedPath)}`);
	const proxy = await getPlatformProxy({ configPath: wranglerPath, persist: true, remoteBindings: ctx.remote });
	try {
		const db = dbFor(config, proxy.env, 'first-primary');
		let storage;
		try {
			storage = storageFor(config, proxy.env);
		} catch {
			storage = undefined; // no R2 binding: fine unless the seed touches uploads
		}
		const localApi = createLocalApi({ config, db, storage, user: null, source: 'local' }) as Cms;
		const { ctx: seedCtx, stats } = createSeedContext(localApi, ctx.log, {
			config,
			storage: storage as StorageAdapter | undefined,
			readFile: async (p) => new Uint8Array(await fs.promises.readFile(path.resolve(ctx.root, p))),
		});
		await mod.default(seedCtx);
		for (const line of formatStats(stats)) ctx.log(line);
		return stats;
	} finally {
		await proxy.dispose();
	}
}
