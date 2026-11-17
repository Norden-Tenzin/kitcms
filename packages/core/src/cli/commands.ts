/// <reference types="node" />
// Node only (build tooling). Command implementations.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { generateDrizzleSchema } from '../schema/codegen';
import { toTableSpecs } from '../schema/tables';
import { generateTypes } from './generate-types';
import { findD1Binding, isNoSchemaChanges, normalizeDir } from './args';
import { CliError, loadConfig } from './load-config';

export interface Ctx {
	root: string;
	configOption: string | undefined;
	remote: boolean;
	log: (msg: string) => void;
}

const SCHEMA_FILE = 'drizzle/schema.ts';
const MIGRATIONS_DIR = 'migrations';

export async function generateSchema(ctx: Ctx): Promise<{ file: string; changed: boolean }> {
	const { config } = await loadConfig(ctx.root, ctx.configOption);
	const src = generateDrizzleSchema(toTableSpecs(config));
	const file = path.join(ctx.root, SCHEMA_FILE);
	const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
	const changed = prev !== src;
	if (changed) {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, src);
	}
	ctx.log(changed ? `wrote ${SCHEMA_FILE}` : `${SCHEMA_FILE} is up to date`);
	return { file, changed };
}

const TYPES_FILE = 'kitcms-types.d.ts';

export async function generateTypesFile(ctx: Ctx, out?: string): Promise<{ file: string; changed: boolean }> {
	const { config } = await loadConfig(ctx.root, ctx.configOption);
	const src = generateTypes(config);
	const file = path.resolve(ctx.root, out ?? TYPES_FILE);
	const rel = path.relative(ctx.root, file) || TYPES_FILE;
	const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
	const changed = prev !== src;
	if (changed) {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, src);
	}
	ctx.log(changed ? `wrote ${rel}` : `${rel} is up to date`);
	return { file, changed };
}

function resolveDrizzleKitBin(): string {
	const require = createRequire(import.meta.url);
	// `drizzle-kit/package.json` is not exported, so resolve the entry and walk up to its package root.
	let dir = path.dirname(require.resolve('drizzle-kit'));
	while (!fs.existsSync(path.join(dir, 'package.json')) || JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name !== 'drizzle-kit') {
		const parent = path.dirname(dir);
		if (parent === dir) throw new CliError('could not locate drizzle-kit');
		dir = parent;
	}
	const pkgPath = path.join(dir, 'package.json');
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { bin?: string | Record<string, string> };
	const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['drizzle-kit'];
	if (!bin) throw new CliError('could not locate the drizzle-kit binary');
	return path.resolve(path.dirname(pkgPath), bin);
}

/**
 * drizzle/schema.ts imports `drizzle-orm`, which apps may not depend on directly (pnpm is strict).
 * Point CJS resolution at the copy shipped with @kitcms/core as a fallback.
 */
function drizzleOrmNodePath(): string {
	const require = createRequire(import.meta.url);
	let dir = path.dirname(require.resolve('drizzle-orm'));
	while (path.basename(dir) !== 'drizzle-orm') dir = path.dirname(dir);
	const extra = path.dirname(dir);
	return [extra, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
}

function listMigrations(root: string): string[] {
	const dir = path.join(root, MIGRATIONS_DIR);
	return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql')) : [];
}

export async function migrateCreate(ctx: Ctx, name: string | undefined): Promise<void> {
	if (!name) throw new CliError('migrate:create needs a name, e.g. `kitcms migrate:create init`');
	await generateSchema(ctx);
	const before = new Set(listMigrations(ctx.root));
	const res = spawnSync(
		process.execPath,
		[resolveDrizzleKitBin(), 'generate', '--dialect', 'sqlite', '--schema', './drizzle/schema.ts', '--out', `./${MIGRATIONS_DIR}`, '--name', name],
		{ cwd: ctx.root, encoding: 'utf8', env: { ...process.env, NODE_PATH: drizzleOrmNodePath() } },
	);
	const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
	if (res.error) throw new CliError(`failed to run drizzle-kit: ${res.error.message}`);
	if (res.status !== 0) throw new CliError(`drizzle-kit generate failed (exit ${res.status}):\n${output.trim()}`);
	if (isNoSchemaChanges(output)) {
		ctx.log('No schema changes, nothing to migrate.');
		return;
	}
	const created = listMigrations(ctx.root).filter((f) => !before.has(f));
	if (created.length === 0) {
		// drizzle-kit can print an error and still exit 0.
		throw new CliError(`drizzle-kit produced no migration:\n${output.trim()}`);
	}
	for (const f of created) ctx.log(`created ${MIGRATIONS_DIR}/${f}`);
	ctx.log('Review the SQL before applying it: column/table renames appear as drop + add and would lose data.');
}

function resolveWrangler(root: string): { cmd: string; args: string[] } {
	let dir = root;
	for (;;) {
		const bin = path.join(dir, 'node_modules', '.bin', 'wrangler');
		if (fs.existsSync(bin)) return { cmd: bin, args: [] };
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return { cmd: 'npx', args: ['wrangler'] };
}

async function runWrangler(ctx: Ctx, sub: 'apply' | 'list'): Promise<void> {
	const { config } = await loadConfig(ctx.root, ctx.configOption);
	const w = resolveWrangler(ctx.root);
	const args = [...w.args, 'd1', 'migrations', sub, config.bindings.db, ctx.remote ? '--remote' : '--local'];
	ctx.log(`> wrangler ${args.slice(w.args.length).join(' ')}`);
	const code = await new Promise<number>((resolve, reject) => {
		const child = spawn(w.cmd, args, { cwd: ctx.root, stdio: 'inherit' });
		child.on('error', reject);
		child.on('close', (c) => resolve(c ?? 1));
	});
	if (code !== 0) throw new CliError(`wrangler exited with code ${code}`);
}

export const migrate = (ctx: Ctx) => runWrangler(ctx, 'apply');
export const migrateStatus = (ctx: Ctx) => runWrangler(ctx, 'list');

const WRANGLER_FILES = ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml'];

export async function info(ctx: Ctx, version: string): Promise<void> {
	const { path: configPath, config } = await loadConfig(ctx.root, ctx.configOption);
	ctx.log(`kitcms ${version}`);
	ctx.log(`config: ${path.relative(ctx.root, configPath) || configPath}`);
	ctx.log('collections:');
	for (const c of config.collections) ctx.log(`  ${c.slug} (${c.fields.length} fields)${c.slug === config.authCollection ? ' [auth]' : ''}`);
	ctx.log(`auth collection: ${config.authCollection}`);
	ctx.log(`bindings: db=${config.bindings.db}, bucket=${config.bindings.bucket}`);

	const file = WRANGLER_FILES.find((f) => fs.existsSync(path.join(ctx.root, f)));
	if (!file) return ctx.log('wrangler config: not found');
	const d1 = findD1Binding(file, fs.readFileSync(path.join(ctx.root, file), 'utf8'), config.bindings.db);
	if (d1.status === 'skipped') return ctx.log(`wrangler config: ${file} (check skipped: ${d1.reason})`);
	if (d1.status === 'no-binding') return ctx.log(`wrangler config: ${file}: WARNING no d1_databases entry with binding "${config.bindings.db}"`);
	const ok = normalizeDir(d1.migrationsDir) === MIGRATIONS_DIR;
	ctx.log(`wrangler config: ${file}, D1 migrations_dir "${d1.migrationsDir}" ${ok ? 'OK' : `WARNING: kitcms writes to "${MIGRATIONS_DIR}"; set migrations_dir to "${MIGRATIONS_DIR}"`}`);
}
