import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findD1Binding, isNoSchemaChanges, normalizeDir, parseArgs, stripJsonc } from './args';
import { CliError, resolveConfigPath } from './load-config';
import { generateSchema, migrateCreate } from './commands';

const fixtures = path.join(import.meta.dirname, '__fixtures__');
const tmpDirs: string[] = [];
function copyFixture(): string {
	const dir = fs.mkdtempSync(path.join(fixtures, '.run-'));
	tmpDirs.push(dir);
	fs.cpSync(path.join(fixtures, 'app'), dir, { recursive: true });
	return dir;
}
afterEach(() => {
	for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('parseArgs', () => {
	it('parses command, positionals and flags', () => {
		expect(parseArgs(['migrate:create', 'init', '--config', 'a.ts'])).toMatchObject({ command: 'migrate:create', positionals: ['init'], config: 'a.ts' });
		expect(parseArgs(['migrate', '--remote', '--config=b.ts'])).toMatchObject({ command: 'migrate', remote: true, config: 'b.ts' });
		expect(parseArgs(['--help']).help).toBe(true);
		expect(parseArgs(['info', '--wat']).unknown).toEqual(['--wat']);
	});
});

describe('wrangler config', () => {
	it('strips comments and trailing commas but keeps strings', () => {
		const out = JSON.parse(stripJsonc('{ // c\n "u": "http://x//y", /* b */ "a": [1,2,], }'));
		expect(out).toEqual({ u: 'http://x//y', a: [1, 2] });
	});
	it('finds the D1 binding and migrations_dir', () => {
		const text = '{ "d1_databases": [{ "binding": "DB", "database_name": "n", "migrations_dir": "./sql" }] }';
		expect(findD1Binding('wrangler.jsonc', text, 'DB')).toEqual({ status: 'found', databaseName: 'n', migrationsDir: './sql' });
		expect(findD1Binding('wrangler.jsonc', text, 'OTHER')).toEqual({ status: 'no-binding' });
		expect(findD1Binding('wrangler.toml', '', 'DB').status).toBe('skipped');
		expect(normalizeDir('./migrations/')).toBe('migrations');
	});
	it('detects drizzle-kit no-change output', () => {
		expect(isNoSchemaChanges('No schema changes, nothing to migrate')).toBe(true);
	});
});

describe('resolveConfigPath', () => {
	it('prefers src/kitcms.config.ts and errors when missing', () => {
		const app = path.join(fixtures, 'app');
		expect(resolveConfigPath(app)).toBe(path.join(app, 'src/kitcms.config.ts'));
		expect(() => resolveConfigPath(fixtures)).toThrow(CliError);
		expect(() => resolveConfigPath(app, 'nope.ts')).toThrow(/not found/);
	});
});

describe('generate:schema / migrate:create', () => {
	it('writes drizzle/schema.ts only when content changes', async () => {
		const root = copyFixture();
		const logs: string[] = [];
		const ctx = { root, configOption: undefined, remote: false, log: (m: string) => void logs.push(m) };
		expect((await generateSchema(ctx)).changed).toBe(true);
		const src = fs.readFileSync(path.join(root, 'drizzle/schema.ts'), 'utf8');
		expect(src).toContain('sqliteTable("posts"');
		expect((await generateSchema(ctx)).changed).toBe(false);
	}, 60_000);

	it('creates a migration SQL file and reports no changes the second time', async () => {
		const root = copyFixture();
		const logs: string[] = [];
		const ctx = { root, configOption: undefined, remote: false, log: (m: string) => void logs.push(m) };
		await migrateCreate(ctx, 'init');
		const sql = fs.readdirSync(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql'));
		expect(sql).toEqual(['0000_init.sql']);
		expect(fs.readFileSync(path.join(root, 'migrations', sql[0]!), 'utf8')).toContain('CREATE TABLE');
		logs.length = 0;
		await migrateCreate(ctx, 'again');
		expect(logs.join('\n')).toMatch(/No schema changes/);
	}, 60_000);
});
