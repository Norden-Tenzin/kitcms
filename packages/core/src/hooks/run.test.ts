import { describe, expect, it } from 'vitest';
import type { KitcmsReq } from '../config/hooks';
import { array, group, text } from '../fields/test-fixtures';
import { runFieldHooks, runHooks } from './run';

const req = { user: null, context: {}, source: 'local' } as unknown as KitcmsReq;

describe('runHooks', () => {
	it('runs sequentially, passing replacements along', async () => {
		const calls: string[] = [];
		const result = await runHooks(
			[
				async (a: { n: number }) => {
					calls.push(`a${a.n}`);
					return a.n + 1;
				},
				(a: { n: number }) => void calls.push(`b${a.n}`),
				(a: { n: number }) => {
					calls.push(`c${a.n}`);
					return a.n * 10;
				},
			],
			{ n: 1 },
			'n',
		);
		expect(result).toBe(20);
		expect(calls).toEqual(['a1', 'b2', 'c2']);
	});
	it('returns the original with no hooks and does not mutate args', async () => {
		const args = { doc: { a: 1 } };
		expect(await runHooks([], args, 'doc')).toBe(args.doc);
		const out = await runHooks([() => ({ a: 2 })], args, 'doc');
		expect(out).toEqual({ a: 2 });
		expect(args.doc).toEqual({ a: 1 });
	});
});

describe('runFieldHooks', () => {
	it('runs hooks with full args and replaces values', async () => {
		const seen: Record<string, unknown>[] = [];
		const fields = [
			text('title', {
				hooks: {
					beforeValidate: [],
					beforeChange: [
						(a: { value: unknown }) => `${a.value}!`,
						(a: Record<string, unknown>) => {
							seen.push(a);
						},
					],
					afterChange: [],
					afterRead: [],
				},
			}),
		];
		const data = { title: 'hi' };
		const originalDoc = { title: 'old' };
		await runFieldHooks('beforeChange', fields, data, { req, operation: 'update', originalDoc });
		expect(data.title).toBe('hi!');
		expect(seen[0]).toMatchObject({ value: 'hi!', operation: 'update', originalDoc, data, siblingData: data });
		expect(seen[0]!.req).toBe(req);
	});

	it('runs container hooks before children, with nested sibling data', async () => {
		const order: string[] = [];
		const h = (name: string) => ({
			beforeValidate: [
				(a: { value: unknown; siblingData: Record<string, unknown>; data: unknown }) => {
					order.push(name);
					if (name === 'g') return { label: 'replaced' };
					if (name === 'label') expect(a.siblingData).toEqual({ label: 'replaced' });
				},
			],
			beforeChange: [],
			afterChange: [],
			afterRead: [],
		});
		const fields = [
			group('g', [text('label', { hooks: h('label') })], { hooks: h('g') }),
			array('rows', [text('x', { hooks: h('x') })]),
		];
		const data: Record<string, unknown> = { g: { label: 'orig' }, rows: [{ x: 1 }, { x: 2 }] };
		await runFieldHooks('beforeValidate', fields, data, { req, operation: 'create' });
		expect(order).toEqual(['g', 'label', 'x', 'x']);
		expect(data.g).toEqual({ label: 'replaced' });
	});

	it('only runs the requested phase', async () => {
		let ran = false;
		const fields = [
			text('t', {
				hooks: { beforeValidate: [], beforeChange: [], afterChange: [], afterRead: [() => void (ran = true)] },
			}),
		];
		await runFieldHooks('afterChange', fields, { t: 1 }, { req, operation: 'create' });
		expect(ran).toBe(false);
		await runFieldHooks('afterRead', fields, { t: 1 }, { req, operation: 'read' });
		expect(ran).toBe(true);
	});
});
