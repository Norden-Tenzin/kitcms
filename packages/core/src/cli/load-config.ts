/// <reference types="node" />
// Node only (build tooling). Loads the app's kitcms config through Vite so `.svelte` and `#lib` imports resolve.
import fs from 'node:fs';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { runnerImport } from 'vite';
import { sanitizeConfig } from '../config/sanitize';
import type { SanitizedConfig } from '../config/sanitized';
import type { Config } from '../config/collection';
import { CONFIG_CANDIDATES } from './args';

export class CliError extends Error {}

export function resolveConfigPath(root: string, explicit?: string): string {
	if (explicit) {
		const p = path.resolve(root, explicit);
		if (!fs.existsSync(p)) throw new CliError(`config not found: ${p}`);
		return p;
	}
	for (const c of CONFIG_CANDIDATES) {
		const p = path.join(root, c);
		if (fs.existsSync(p)) return p;
	}
	throw new CliError(`no kitcms config found in ${root} (looked for ${CONFIG_CANDIDATES.join(', ')}). Use --config <path>.`);
}

export interface LoadedConfig {
	path: string;
	config: SanitizedConfig;
}

export async function loadConfig(root: string, explicit?: string): Promise<LoadedConfig> {
	const configPath = resolveConfigPath(root, explicit);
	let mod: { default?: Config };
	try {
		({ module: mod } = await runnerImport<{ default?: Config }>(configPath, {
			root,
			configFile: false,
			plugins: [svelte()],
			logLevel: 'warn',
		}));
	} catch (e) {
		throw new CliError(`failed to load ${configPath}: ${(e as Error).message}`);
	}
	if (!mod.default) throw new CliError(`${configPath} has no default export. Use \`export default defineConfig({ ... })\`.`);
	return { path: configPath, config: sanitizeConfig(mod.default) };
}
