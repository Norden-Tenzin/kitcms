// Node-only: deploy apps/dev as a SEPARATE Worker (kitcms-bench), then time cold + warm requests.
// Run: node scripts/bench/cold-start.ts [--no-deploy] [--base-url https://...] [--name kitcms-bench]
//   --no-deploy   skip build + deploy (requires --base-url or BENCH_BASE_URL)
// Never deploys kitcms-dev or kitcms-dev-consumer: the Worker name is forced and guarded.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const appDir = join(root, 'apps/dev');
const args = process.argv.slice(2);
const opt = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};
const name = opt('name') ?? 'kitcms-bench';
if (!name.startsWith('kitcms-bench')) throw new Error(`refusing to deploy Worker "${name}"`);

let baseUrl = opt('base-url') ?? process.env.BENCH_BASE_URL;
let startupMs: number | null = null;

if (!args.includes('--no-deploy')) {
	const run = (cmd: string, a: string[]) => {
		const r = spawnSync(cmd, a, { cwd: appDir, encoding: 'utf8' });
		const text = (r.stdout ?? '') + (r.stderr ?? '');
		if (r.status !== 0) {
			console.error(text);
			throw new Error(`${cmd} ${a.join(' ')} failed`);
		}
		return text;
	};
	run('pnpm', ['build']);
	const deployLog = run('npx', ['wrangler', 'deploy', '--name', name, '--var', 'KITCMS_BENCH:1']);
	console.log(deployLog);
	const m = /Worker Startup Time:\s*([\d.]+)\s*ms/i.exec(deployLog);
	startupMs = m ? Number(m[1]) : null;
	const url = /https:\/\/[^\s]+\.workers\.dev/.exec(deployLog)?.[0];
	baseUrl ??= url;
}
if (!baseUrl) throw new Error('no base URL: pass --base-url or set BENCH_BASE_URL');
baseUrl = baseUrl.replace(/\/$/, '');

async function time(path: string) {
	const t0 = performance.now();
	const res = await fetch(baseUrl + path);
	const body = await res.text();
	return {
		status: res.status,
		ms: +(performance.now() - t0).toFixed(1),
		bytes: body.length,
		colo: res.headers.get('cf-ray')?.split('-')[1] ?? null,
	};
}

const paths = ['/', '/spike/bench?blocks=15&iterations=1'];
const results: Record<string, Awaited<ReturnType<typeof time>>[]> = {};
for (const p of paths) {
	const runs = [];
	// First request after deploy is the cold one (for the bench route it also seeds bench-15 once).
	for (let i = 0; i < 11; i++) runs.push(await time(p));
	results[p] = runs;
}

const summary = Object.entries(results).map(([path, runs]) => {
	const warm = runs
		.slice(1)
		.map((r) => r.ms)
		.sort((a, b) => a - b);
	return {
		path,
		firstMs: runs[0]!.ms,
		warmMin: warm[0],
		warmMedian: warm[Math.floor(warm.length / 2)],
		warmMax: warm[warm.length - 1],
		statuses: [...new Set(runs.map((r) => r.status))].join(','),
	};
});

console.log(`\nbase: ${baseUrl}\nWorker Startup Time (wrangler): ${startupMs ?? 'n/a'} ms`);
console.table(summary);
mkdirSync(join(root, 'scripts/bench/out'), { recursive: true });
writeFileSync(
	join(root, 'scripts/bench/out/cold-start.json'),
	JSON.stringify(
		{
			baseUrl,
			workerName: name,
			workerStartupMs: startupMs,
			at: new Date().toISOString(),
			note: 'Client-side wall time from this machine, includes network RTT. firstMs of "/" is the cold request; the bench route first call also seeds D1.',
			summary,
			runs: results,
		},
		null,
		2,
	),
);
console.log('wrote scripts/bench/out/cold-start.json');
