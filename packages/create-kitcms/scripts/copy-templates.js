// prepack: copy the repo-level templates/ into this package so they ship with it.
// At dev time (monorepo checkout) the CLI resolves ../../templates directly instead.
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const dest = fileURLToPath(new URL('templates', root));
rmSync(dest, { recursive: true, force: true });
cpSync(fileURLToPath(new URL('../../templates', root)), dest, {
	recursive: true,
	filter: (src) => !/[\\/](node_modules|\.svelte-kit|\.wrangler|dist)([\\/]|$)/.test(src),
});
