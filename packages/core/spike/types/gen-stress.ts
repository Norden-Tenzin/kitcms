// SPIKE: generates a stress config — N collections, M shared block types with nested arrays/groups/blocks
// (3 levels), relationships between collections — plus code that uses every collection at depth 0/1/2.
import fs from 'node:fs';
import path from 'node:path';

const N = Number(process.argv[2] ?? 30);
const M = Number(process.argv[3] ?? 15);
const out = path.join(import.meta.dirname, 'stress');
fs.mkdirSync(out, { recursive: true });

const lines: string[] = [
	"import { block, collection, defineConfig, f, type LocalAPI } from '../kit.ts';",
	'',
];
// Leaf blocks (level 3), then mid blocks containing arrays of groups with leaf blocks, then top blocks.
for (let i = 0; i < M; i++) {
	lines.push(
		`const Leaf${i} = block({ slug: 'leaf${i}', fields: { title: f.text({ required: true }), body: f.textarea(), n: f.number(), kind: f.select({ options: ['a${i}', 'b${i}', 'c${i}'] }), image: f.upload({ relationTo: 'media' }) } });`,
	);
}
for (let i = 0; i < M; i++) {
	const leaves = [0, 1, 2, 3].map((k) => `Leaf${(i + k) % M}`).join(', ');
	lines.push(
		`const Mid${i} = block({ slug: 'mid${i}', fields: { heading: f.text({ required: true }), items: f.array({ fields: { label: f.text({ required: true }), meta: f.group({ fields: { note: f.text(), at: f.date(), link: f.relationship({ relationTo: 'c${i % N}' }) } }), inner: f.blocks({ blocks: [${leaves}] }) } }) } });`,
	);
}
for (let i = 0; i < M; i++) {
	const mids = [0, 1, 2].map((k) => `Mid${(i + k) % M}`).join(', ');
	lines.push(
		`const Top${i} = block({ slug: 'top${i}', fields: { title: f.text({ required: true }), settings: f.group({ fields: { theme: f.select({ options: ['light', 'dark'] }), wide: f.checkbox() } }), children: f.blocks({ blocks: [${mids}] }) } });`,
	);
}
lines.push('', 'export const config = defineConfig({', '\tcollections: [');
lines.push(
	`\t\tcollection({ slug: 'media', upload: true, fields: { alt: f.text(), caption: f.textarea() } }),`,
);
for (let i = 0; i < N; i++) {
	const tops = [0, 1, 2, 3, 4].map((k) => `Top${(i + k) % M}`).join(', ');
	lines.push(
		`\t\tcollection({ slug: 'c${i}', versions: { drafts: true }, admin: { useAsTitle: 'title' }, fields: {`,
	);
	lines.push(
		`\t\t\ttitle: f.text({ required: true }), slug: f.slug({ from: 'title', unique: true }), views: f.number(), published: f.checkbox(), at: f.date(),`,
	);
	lines.push(
		`\t\t\tstatus: f.select({ options: ['s1', 's2', 's3'], required: true }), cover: f.upload({ relationTo: 'media' }),`,
	);
	lines.push(
		`\t\t\tnext: f.relationship({ relationTo: 'c${(i + 1) % N}' }), related: f.relationship({ relationTo: 'c${(i + 2) % N}', hasMany: true }),`,
	);
	lines.push(
		`\t\t\tseo: f.group({ fields: { metaTitle: f.text(), metaDescription: f.textarea(), noIndex: f.checkbox() } }),`,
	);
	lines.push(
		`\t\t\tgallery: f.array({ fields: { image: f.upload({ relationTo: 'media', required: true }), caption: f.text() } }),`,
	);
	lines.push(`\t\t\tsections: f.blocks({ blocks: [${tops}] }),`);
	lines.push('\t\t} }),');
}
lines.push(
	'\t]',
	'});',
	'',
	'export type Cfg = typeof config;',
	'export declare const cms: LocalAPI<Cfg>;',
);
fs.writeFileSync(path.join(out, 'config.ts'), lines.join('\n') + '\n');

const use: string[] = ["import { cms } from './config.ts';", '', 'export async function use() {'];
for (let i = 0; i < N; i++) {
	use.push(
		`\t{ const r = await cms.find('c${i}', { where: { views: { greater_than: 1 }, or: [{ status: { equals: 's1' } }] }, sort: '-at', depth: ${i % 3} as ${i % 3} });`,
	);
	use.push(
		`\t  const d = r.docs[0]!; const s = d.sections[0]!; const t: string = d.title; void t;`,
	);
	use.push(
		`\t  if (s.blockType === 'top${i % M}') { const c = s.children[0]!; if (c.blockType === 'mid${i % M}') { const it = c.items[0]!; const l: string = it.label; void l; const inner = it.inner[0]; void inner; } } }`,
	);
}
use.push('}');
fs.writeFileSync(path.join(out, 'usage.ts'), use.join('\n') + '\n');
console.log(`wrote ${N} collections, ${M * 3} block types to ${out}`);
