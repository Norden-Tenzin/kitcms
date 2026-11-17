#!/usr/bin/env node
// The package ships TypeScript sources (no build step), and Node does not strip types inside
// node_modules. Vite's module runner (already required to load the user's config) transpiles
// the CLI on the fly, so this works from node_modules with no extra dependency.
import { runnerImport } from 'vite';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url));
const { module } = await runnerImport(entry, { root: process.cwd(), configFile: false, logLevel: 'error' });
process.exitCode = await module.run(process.argv.slice(2), process.cwd());
