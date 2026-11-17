// prepack: copy the repo-level templates/ into this package so they ship with it, and pin the
// templates' `@kitcms/*` dependencies to the versions being published (from the workspace's
// package.json files; changesets bumps them before `pnpm publish` packs this package).
// At dev time (monorepo checkout) the CLI resolves ../../templates directly instead.
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const dest = fileURLToPath(new URL('templates', root));
rmSync(dest, { recursive: true, force: true });
cpSync(fileURLToPath(new URL('../../templates', root)), dest, {
	recursive: true,
	filter: (src) => !/[\\/](node_modules|\.svelte-kit|\.wrangler|dist)([\\/]|$)/.test(src),
});

// name → version of every workspace package
const packagesDir = fileURLToPath(new URL('../', root));
const versions = new Map();
for (const dir of readdirSync(packagesDir)) {
	const file = `${packagesDir}/${dir}/package.json`;
	if (!existsSync(file)) continue;
	const pkg = JSON.parse(readFileSync(file, 'utf8'));
	versions.set(pkg.name, pkg.version);
}

for (const template of readdirSync(dest)) {
	const file = `${dest}/${template}/package.json`;
	if (!existsSync(file)) continue;
	const pkg = JSON.parse(readFileSync(file, 'utf8'));
	for (const field of ['dependencies', 'devDependencies']) {
		for (const name of Object.keys(pkg[field] ?? {})) {
			if (!name.startsWith('@kitcms/')) continue;
			const v = versions.get(name);
			if (!v) throw new Error(`copy-templates: ${template} depends on unknown package ${name}`);
			if (v === '0.0.0') throw new Error(`copy-templates: ${name} is still 0.0.0; run \`pnpm changeset version\` first`);
			pkg[field][name] = `^${v}`;
		}
	}
	writeFileSync(file, JSON.stringify(pkg, null, '\t') + '\n');
}
