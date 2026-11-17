// Node-only: build apps/playground, `wrangler deploy --dry-run --outdir <tmp> --metafile`, report Worker size.
// Run: node scripts/bench/bundle-size.ts [--skip-build]
import { spawnSync } from 'node:child_process';
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '../..');
const appDir = join(root, 'apps/playground');
const outDir = mkdtempSync(join(tmpdir(), 'kitcms-bundle-'));

function run(cmd: string, args: string[]): string {
	const r = spawnSync(cmd, args, { cwd: appDir, encoding: 'utf8' });
	const text = (r.stdout ?? '') + (r.stderr ?? '');
	if (r.status !== 0) {
		console.error(text);
		throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
	}
	return text;
}

if (!process.argv.includes('--skip-build')) run('pnpm', ['build']);
const log = run('npx', ['wrangler', 'deploy', '--dry-run', '--outdir', outDir, '--metafile']);
const wranglerLine = /Total Upload:[^\n]*/.exec(log)?.[0] ?? null;

// Worker modules (everything wrangler emitted that is JS/WASM, not maps/metafile).
const files = readdirSync(outDir).filter((f) => /\.(m?js|wasm)$/.test(f));
const modules = files.map((f) => {
	const buf = readFileSync(join(outDir, f));
	return { file: f, raw: buf.length, gzip: gzipSync(buf).length };
});
const total = {
	raw: modules.reduce((n, m) => n + m.raw, 0),
	gzip: modules.reduce((n, m) => n + m.gzip, 0),
};

// Top contributors from the esbuild metafile, grouped by package.
type Meta = { outputs: Record<string, { inputs: Record<string, { bytesInOutput: number }> }> };
const meta = JSON.parse(readFileSync(join(outDir, 'bundle-meta.json'), 'utf8')) as Meta;
const byInput = new Map<string, number>();
for (const [name, out] of Object.entries(meta.outputs)) {
	if (name.endsWith('.map')) continue;
	for (const [input, v] of Object.entries(out.inputs))
		byInput.set(input, (byInput.get(input) ?? 0) + v.bytesInOutput);
}
const groupOf = (p: string): string => {
	const i = p.lastIndexOf('node_modules/');
	if (i >= 0) {
		const rest = p.slice(i + 'node_modules/'.length).split('/');
		return rest[0]!.startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0]!;
	}
	if (p.includes('.svelte-kit/')) return '(sveltekit output)';
	return p.replace(/^(\.\.\/)+/, '');
};
const byGroup = new Map<string, number>();
for (const [p, b] of byInput) byGroup.set(groupOf(p), (byGroup.get(groupOf(p)) ?? 0) + b);
const top = (m: Map<string, number>, n: number) =>
	[...m]
		.sort((a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([name, bytes]) => ({ name, bytes }));

const assetsDir = join(appDir, '.svelte-kit/cloudflare');
const walk = (d: string): number =>
	readdirSync(d).reduce((n, f) => {
		const p = join(d, f);
		return n + (statSync(p).isDirectory() ? walk(p) : statSync(p).size);
	}, 0);

const report = {
	wranglerReported: wranglerLine,
	workerModules: modules,
	total,
	topPackages: top(byGroup, 15),
	topModules: top(byInput, 15),
	staticAssetsBytes: walk(assetsDir),
	note: 'Sizes are bytesInOutput from the esbuild metafile (pre-gzip). Total = sum of emitted JS/WASM modules.',
};

const kb = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
console.log(wranglerLine ?? '');
console.log(`\nWorker modules: raw ${kb(total.raw)}, gzip ${kb(total.gzip)}`);
console.table(modules.map((m) => ({ file: m.file, raw: kb(m.raw), gzip: kb(m.gzip) })));
console.log('Top packages (bytes in output):');
console.table(report.topPackages.map((t) => ({ name: t.name, size: kb(t.bytes) })));
console.log('Top modules:');
console.table(report.topModules.map((t) => ({ name: t.name.slice(-90), size: kb(t.bytes) })));

mkdirSync(join(root, 'scripts/bench/out'), { recursive: true });
writeFileSync(join(root, 'scripts/bench/out/bundle.json'), JSON.stringify(report, null, 2));
console.log('wrote scripts/bench/out/bundle.json');
