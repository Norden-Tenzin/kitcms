// Node-only (same V8 as workerd): JSON.parse / stringify / Drizzle row-mapping cost
// for the bench payload shapes. Run: node scripts/bench/parse.ts
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildTables } from '../../apps/dev/kitcms-spike/drizzle-runtime.ts';
import { toTableSpecs } from '../../apps/dev/kitcms-spike/schema-spec.ts';
import { benchMediaIds, makeSections } from '../../apps/dev/kitcms-spike/bench-payload.ts';

const ITERS = 20000;

function bench(fn: () => unknown, iters = ITERS): number {
	for (let i = 0; i < 2000; i++) fn(); // warm-up (JIT)
	const t0 = performance.now();
	for (let i = 0; i < iters; i++) fn();
	return ((performance.now() - t0) * 1000) / iters; // µs per op
}

// The real Drizzle JSON column (text mode: 'json'), built from the spike config's spec.
// Config imports a .svelte file, so build the one column we need from a minimal spec instead.
const tables = buildTables([
	{
		name: 'pages',
		columns: [
			{ name: 'id', kind: 'text', primaryKey: true, notNull: true },
			{ name: 'sections', kind: 'json' },
		],
		indexes: [],
	} as unknown as ReturnType<typeof toTableSpecs>[number],
]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const col = (tables.pages as any).sections as { mapFromDriverValue(v: unknown): unknown };

const results: Record<string, unknown>[] = [];
for (const blocks of [10, 20]) {
	const sections = makeSections(blocks, benchMediaIds(blocks));
	const text = JSON.stringify(sections);
	results.push({
		blocks,
		bytes: Buffer.byteLength(text),
		parseUs: +bench(() => JSON.parse(text)).toFixed(2),
		stringifyUs: +bench(() => JSON.stringify(sections)).toFixed(2),
		drizzleColumnMapUs: +bench(() => col.mapFromDriverValue(text)).toFixed(2),
	});
}

console.log(
	`node ${process.version} ${process.arch}, ${ITERS} iterations after warm-up (µs per op)\n`,
);
console.table(results);
const dir = new URL('./out/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(
	new URL('parse.json', dir),
	JSON.stringify({ node: process.version, iterations: ITERS, results }, null, 2),
);
