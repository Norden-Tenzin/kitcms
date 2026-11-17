import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseArgs, parseDatabaseId, run, type Deps } from '../src/index.js';
import { findPlaceholders, isNonEmptyDir, replacePlaceholders, toAppName } from '../src/scaffold.js';

let tmp: string;
beforeEach(() => void (tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'create-kitcms-'))));
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

function deps(logs: string[] = []): Deps {
	return {
		cwd: tmp,
		log: (m) => void logs.push(m),
		exec: async () => ({ code: 1, stdout: '', stderr: '' }),
		ask: async (_q, d) => d,
		interactive: false,
	};
}

describe('parseArgs', () => {
	it('parses flags and the positional dir', () => {
		const a = parseArgs(['my-app', '--template=blank', '--yes', '--no-install', '--create-resources', '--link', '/repo']);
		expect(a).toMatchObject({ dir: 'my-app', template: 'blank', yes: true, install: false, createResources: true, link: '/repo' });
		expect(a.unknown).toEqual([]);
	});
	it('collects unknown options', () => {
		expect(parseArgs(['--nope', 'a', 'b']).unknown).toEqual(['--nope', 'b']);
		expect(parseArgs(['--link']).unknown).toHaveLength(1);
	});
});

describe('helpers', () => {
	it('replaces placeholders', () => {
		const v = { __APP_NAME__: 'a', __DB_NAME__: 'b', __DB_ID__: 'c', __BUCKET_NAME__: 'd' };
		expect(replacePlaceholders('__APP_NAME__ __DB_NAME__ __DB_ID__ __BUCKET_NAME__ __APP_NAME__', v)).toBe('a b c d a');
	});
	it('normalizes app names', () => {
		expect(toAppName('My Cool_App!')).toBe('my-cool-app');
		expect(toAppName('!!!')).toBe('kitcms-app');
	});
	it('parses the D1 id from JSON and TOML output', () => {
		const id = '64e7ad86-8d61-47e1-9c24-eae78559a387';
		expect(parseDatabaseId(`{\n "d1_databases": [{ "binding": "DB", "database_id": "${id}" }]\n}`)).toBe(id);
		expect(parseDatabaseId(`[[d1_databases]]\ndatabase_id = "${id}"`)).toBe(id);
		expect(parseDatabaseId(`created ${id}`)).toBe(id);
		expect(parseDatabaseId('nothing')).toBeUndefined();
	});
});

describe('run', () => {
	it('refuses a non-empty directory', async () => {
		fs.mkdirSync(path.join(tmp, 'app'));
		fs.writeFileSync(path.join(tmp, 'app', 'x'), '');
		const logs: string[] = [];
		expect(await run(['app', '--yes', '--no-install'], deps(logs))).toBe(1);
		expect(logs.join('\n')).toContain('not empty');
		expect(isNonEmptyDir(path.join(tmp, 'app'))).toBe(true);
	});

	it('rejects unknown templates', async () => {
		expect(await run(['app', '--template', 'website'], deps())).toBe(1);
		expect(await run(['app', '--template', 'zzz'], deps())).toBe(1);
	});

	it('scaffolds the blank template', async () => {
		const logs: string[] = [];
		expect(await run(['my-site', '--yes', '--no-install'], deps(logs))).toBe(0);
		const dir = path.join(tmp, 'my-site');
		for (const f of [
			'package.json',
			'vite.config.ts',
			'wrangler.jsonc',
			'tsconfig.json',
			'README.md',
			'.gitignore',
			'.dev.vars',
			'.dev.vars.example',
			'pnpm-workspace.yaml',
			'src/app.html',
			'src/app.d.ts',
			'src/hooks.server.ts',
			'src/kitcms.config.ts',
			'src/kitcms.rpc.ts',
			'src/routes/+page.svelte',
			'src/routes/(kitcms)/admin/[...path]/+page.server.ts',
			'src/routes/(kitcms)/api/[...path]/+server.ts',
		]) {
			expect(fs.existsSync(path.join(dir, f)), f).toBe(true);
		}
		expect(fs.existsSync(path.join(dir, '_gitignore'))).toBe(false);
		expect(findPlaceholders(dir)).toEqual([]);
		const wrangler = fs.readFileSync(path.join(dir, 'wrangler.jsonc'), 'utf8');
		expect(wrangler).toContain('"name": "my-site"');
		expect(wrangler).toContain('<run: wrangler d1 create my-site>');
		expect(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name).toBe('my-site');
		expect(fs.readFileSync(path.join(dir, '.dev.vars'), 'utf8')).toMatch(/^BETTER_AUTH_SECRET=[A-Za-z0-9_-]{43}\n$/);
		expect(logs.join('\n')).toContain('Workers Paid');
	});

	it('writes link: dependencies with --link', async () => {
		await run(['app', '--yes', '--no-install', '--link', '/repo'], deps());
		const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'app', 'package.json'), 'utf8'));
		expect(pkg.dependencies['@kitcms/core']).toBe('link:/repo/packages/core');
		expect(pkg.dependencies['@kitcms/ui']).toBe('link:/repo/packages/ui');
	});
});
