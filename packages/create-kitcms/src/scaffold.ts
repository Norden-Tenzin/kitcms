import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Placeholders {
	__APP_NAME__: string;
	__DB_NAME__: string;
	__DB_ID__: string;
	__BUCKET_NAME__: string;
}

/** Placeholders that may legitimately remain after scaffolding (none: the D1 id gets an explicit hint). */
export const DOCUMENTED_PLACEHOLDERS: readonly string[] = [];

/** Files npm would strip or rename on publish are stored under a different name and restored here. */
const RENAMES: Record<string, string> = { _gitignore: '.gitignore' };

/** Package root: dist/ (or src/) sits one level below it. */
export function packageRoot(): string {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/** Published: `<pkg>/templates` (copied by `prepack`). Monorepo checkout: `<repo>/templates`. */
export function templatesDir(root = packageRoot()): string {
	for (const dir of [path.join(root, 'templates'), path.resolve(root, '../../templates')]) {
		if (fs.existsSync(dir)) return dir;
	}
	throw new Error('kitcms templates not found');
}

export function toAppName(input: string): string {
	return (
		input
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'kitcms-app'
	);
}

/**
 * The app name is reused as the Worker, D1 database and R2 bucket name. R2 bucket names need
 * 3-63 characters; 58 is create-cloudflare's own cap, which keeps every derived name valid.
 * Returns an error message, or undefined when the (already normalized) name is fine.
 */
export function validateAppName(name: string): string | undefined {
	if (name.length < 3 || name.length > 58) {
		return `Project names must be 3-58 characters (got "${name}", ${name.length}): it is also used as the Worker, D1 database and R2 bucket name.`;
	}
	return undefined;
}

export function replacePlaceholders(text: string, values: Placeholders): string {
	let out = text;
	for (const [k, v] of Object.entries(values)) out = out.split(k).join(v);
	return out;
}

const SKIP = new Set(['node_modules', '.svelte-kit', '.wrangler', 'dist']);

export function copyTemplate(src: string, dest: string, values: Placeholders): string[] {
	const written: string[] = [];
	const walk = (from: string, to: string, rel: string) => {
		fs.mkdirSync(to, { recursive: true });
		for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
			if (SKIP.has(entry.name)) continue;
			const name = RENAMES[entry.name] ?? entry.name;
			const target = path.join(to, name);
			const relPath = rel ? `${rel}/${name}` : name;
			if (entry.isDirectory()) walk(path.join(from, entry.name), target, relPath);
			else {
				fs.writeFileSync(target, replacePlaceholders(fs.readFileSync(path.join(from, entry.name), 'utf8'), values));
				written.push(relPath);
			}
		}
	};
	walk(src, dest, '');
	return written;
}

/** True when the directory exists and contains anything. */
export function isNonEmptyDir(dir: string): boolean {
	return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
}

export function generateSecret(): string {
	return randomBytes(32).toString('base64url');
}

export function writeDevVars(dir: string, secret = generateSecret()): void {
	fs.writeFileSync(path.join(dir, '.dev.vars'), `BETTER_AUTH_SECRET=${secret}\n`);
}

/** Rewrites the `@kitcms/*` dependencies to `link:` paths of a local checkout. */
export function linkDependencies(dir: string, repo: string): void {
	const file = path.join(dir, 'package.json');
	const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as { dependencies: Record<string, string> };
	const abs = path.resolve(repo);
	for (const name of Object.keys(pkg.dependencies)) {
		if (name.startsWith('@kitcms/')) pkg.dependencies[name] = `link:${path.join(abs, 'packages', name.slice('@kitcms/'.length))}`;
	}
	fs.writeFileSync(file, JSON.stringify(pkg, null, '\t') + '\n');
}

/** Replaces the D1 id placeholder in wrangler.jsonc. */
export function setDatabaseId(dir: string, id: string): void {
	const file = path.join(dir, 'wrangler.jsonc');
	fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/("database_id":\s*)"[^"]*"/, `$1"${id}"`));
}

/** Lists leftover `__NAME__` placeholders in a scaffolded tree (for tests and sanity checks). */
export function findPlaceholders(dir: string): string[] {
	const found: string[] = [];
	const walk = (d: string) => {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			if (SKIP.has(e.name)) continue;
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (/__[A-Z_]+__/.test(fs.readFileSync(p, 'utf8'))) found.push(path.relative(dir, p));
		}
	};
	walk(dir);
	return found;
}
