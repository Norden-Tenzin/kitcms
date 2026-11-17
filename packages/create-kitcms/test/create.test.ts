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
		const id = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
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
		expect(await run(['app', '--template', 'zzz'], deps())).toBe(1);
	});

	it('prompts for the template when interactive and none is given', async () => {
		const asked: string[] = [];
		const d = { ...deps(), interactive: true, ask: async (q: string, f: string) => (asked.push(q), q.startsWith('Template') ? 'website' : f) };
		expect(await run(['picked', '--no-install'], d)).toBe(0);
		expect(asked[0]).toContain('blank | website');
		expect(fs.existsSync(path.join(tmp, 'picked', 'src/kitcms.seed.ts'))).toBe(true);
	});

	it('scaffolds the website template', async () => {
		const logs: string[] = [];
		expect(await run(['studio', '--template', 'website', '--yes', '--no-install'], deps(logs))).toBe(0);
		const dir = path.join(tmp, 'studio');
		for (const f of [
			'package.json',
			'wrangler.jsonc',
			'README.md',
			'.gitignore',
			'.dev.vars',
			'src/app.css',
			'src/app.d.ts',
			'src/kitcms.config.ts',
			'src/kitcms.admin.ts',
			'src/kitcms.seed.ts',
			'src/kitcms.rpc.ts',
			'src/lib/image.ts',
			'src/lib/blocks/RenderBlocks.svelte',
			'src/lib/blocks/AdminPreview.svelte',
			'src/lib/blocks/Hero.svelte',
			'src/lib/blocks/TeamGrid.svelte',
			'src/routes/(site)/+layout.svelte',
			'src/routes/(site)/+page.server.ts',
			'src/routes/(site)/[slug]/+page.svelte',
			'src/routes/(site)/blog/+page.svelte',
			'src/routes/(site)/blog/[slug]/+page.svelte',
			'src/routes/(site)/legal/[slug]/+page.svelte',
			'src/routes/(kitcms)/admin/[...path]/+page.svelte',
			'src/routes/(kitcms)/api/[...path]/+server.ts',
		]) {
			expect(fs.existsSync(path.join(dir, f)), f).toBe(true);
		}
		expect(findPlaceholders(dir)).toEqual([]);
		expect(fs.readFileSync(path.join(dir, 'wrangler.jsonc'), 'utf8')).toContain('"placement": { "mode": "smart" }');
		expect(fs.readFileSync(path.join(dir, 'src/kitcms.config.ts'), 'utf8')).toContain("title: 'studio'");
		expect(fs.readFileSync(path.join(dir, 'src/routes/(kitcms)/admin/[...path]/+page.svelte'), 'utf8')).toContain('admin={adminConfig}');
		expect(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts['db:seed']).toBe('kitcms seed');
		const out = logs.join('\n');
		expect(out).toContain('pnpm kitcms seed');
		expect(out).toContain('Workers Paid');
	});

	it('does not suggest seeding for the blank template', async () => {
		const logs: string[] = [];
		await run(['plain', '--yes', '--no-install'], deps(logs));
		expect(logs.join('\n')).not.toContain('kitcms seed');
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
