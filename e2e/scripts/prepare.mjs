// Prepares an isolated e2e run: wipes the persist dir, builds apps/dev and applies the migrations
// to a fresh local D1 in that dir. Never touches apps/dev/.wrangler or any remote resource.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const state = path.join(root, '.e2e-state');
const dev = path.join(root, 'apps/dev');

function run(args, cwd) {
	const res = spawnSync('pnpm', args, { cwd, stdio: 'inherit' });
	if (res.status !== 0) process.exit(res.status ?? 1);
}

fs.rmSync(state, { recursive: true, force: true });
fs.mkdirSync(state, { recursive: true });
if (process.env.E2E_SKIP_BUILD !== '1') run(['--filter', 'dev', 'build'], root);
run(['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state], dev);
