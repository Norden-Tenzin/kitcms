// SPIKE (Phase 0): `kitcms generate:schema` prototype. Node only (build tooling).
// Loads kitcms.config.ts through Vite so `#lib` and `.svelte` imports resolve.
import fs from 'node:fs';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { runnerImport } from 'vite';
import { generateDrizzleSchema } from './codegen.ts';
import { toTableSpecs, type SpikeConfig } from './schema-spec.ts';

const root = path.resolve(import.meta.dirname, '..');
const t0 = performance.now();
const { module } = await runnerImport<{ default: SpikeConfig }>(
	path.join(root, 'src/kitcms.config.ts'),
	{ root, configFile: false, plugins: [svelte()], logLevel: 'warn' },
);
const t1 = performance.now();
const src = generateDrizzleSchema(toTableSpecs(module.default));
fs.mkdirSync(path.join(root, 'drizzle'), { recursive: true });
fs.writeFileSync(path.join(root, 'drizzle/schema.ts'), src);
console.log(`config loaded via Vite in ${(t1 - t0).toFixed(0)} ms; wrote drizzle/schema.ts`);
