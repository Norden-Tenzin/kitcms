// RPC writes + draft reads (security-critical, plan §13.8). Written by Opus.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ WorkerEntrypoint: class {} }));
const dbFor = vi.fn<(...a: unknown[]) => object>(() => ({}));
vi.mock('../runtime', () => ({ dbFor, storageFor: vi.fn(() => undefined), isReadOnly: () => false }));

const calls: { method: string; args: unknown[] }[] = [];
vi.mock('../api/local', () => ({
	createLocalApi: vi.fn((ctx: { user: unknown; source: string }) => {
		expect(ctx.user).toBeNull();
		expect(ctx.source).toBe('rpc');
		return new Proxy(
			{},
			{
				get: (_t, method: string) =>
					(...args: unknown[]) => {
						calls.push({ method, args });
						return Promise.resolve({ ok: true });
					},
			},
		);
	}),
}));

const { createKitcmsRPC, readRpcOptions } = await import('./index');
const { defineConfig, collection } = await import('../config/collection');

const RPC = createKitcmsRPC(defineConfig({ collections: [collection({ slug: 'pages', fields: {} })] }));
function stub() {
	const Ctor = RPC as unknown as new () => InstanceType<typeof RPC> & { env: object; ctx: object };
	const rpc = new Ctor();
	Object.assign(rpc, { env: {}, ctx: { waitUntil: () => {} } });
	return rpc;
}
const wireError = (code: string) => new RegExp(`^kitcms:${code}:`);

beforeEach(() => {
	calls.length = 0;
	dbFor.mockClear();
});

describe('RPC D1 session constraint (§13.10)', () => {
	const startOf = () => dbFor.mock.calls.at(-1)![2];
	it('anonymous reads use first-unconstrained', async () => {
		await stub().find('pages');
		expect(startOf()).toBe('first-unconstrained');
	});
	it('system reads use first-primary', async () => {
		await stub().find('pages', { as: 'system' });
		expect(startOf()).toBe('first-primary');
		await stub().count('pages', { as: 'system' });
		expect(startOf()).toBe('first-primary');
	});
	it('writes use first-primary', async () => {
		await stub().create('pages', { title: 'x' }, { as: 'system' });
		expect(startOf()).toBe('first-primary');
	});
});

describe('RPC writes need as: "system"', () => {
	const attempts: [string, (r: ReturnType<typeof stub>, opts: unknown) => Promise<unknown>][] = [
		['create', (r, o) => r.create('pages', { title: 'x' }, o as never)],
		['update', (r, o) => r.update('pages', 'id1', { title: 'x' }, o as never)],
		['delete', (r, o) => r.delete('pages', 'id1', o as never)],
		['move', (r, o) => r.move('pages', 'id1', { after: 'id2' }, o as never)],
		['unpublish', (r, o) => r.unpublish('pages', 'id1', o as never)],
		['updateGlobal', (r, o) => r.updateGlobal('site', { name: 'x' }, o as never)],
	];
	const bad: unknown[] = [
		undefined,
		null,
		{},
		{ as: 'admin' },
		{ as: true },
		{ overrideAccess: true },
		{ as: 'System' },
		Object.create({ as: 'system' }),
		['system'],
		'system',
	];

	for (const [name, call] of attempts) {
		it(`${name}: FORBIDDEN without system, before any Local API call`, async () => {
			for (const opts of bad) {
				await expect(call(stub(), opts)).rejects.toThrow(wireError('FORBIDDEN'));
			}
			expect(calls).toEqual([]);
		});
		it(`${name}: runs with overrideAccess when system`, async () => {
			await call(stub(), { as: 'system' });
			expect(calls).toHaveLength(1);
			expect(calls[0]!.method).toBe(name);
			const opts = calls[0]!.args.at(-1) as Record<string, unknown>;
			expect(opts.overrideAccess).toBe(true);
			expect(opts).not.toHaveProperty('as');
		});
	}

	it('system writes still reject privileged/unknown options', async () => {
		for (const key of ['overrideAccess', 'req', 'context', 'user', 'autosave']) {
			await expect(stub().create('pages', {}, { as: 'system', [key]: true } as never)).rejects.toThrow(
				wireError('QUERY'),
			);
		}
		expect(calls).toEqual([]);
	});

	it('data must be a plain object', async () => {
		for (const data of [null, [], 'x', Object.create({ title: 'x' })]) {
			await expect(stub().create('pages', data as never, { as: 'system' })).rejects.toThrow(wireError('QUERY'));
		}
	});

	it('move target must be exactly one of before/after', async () => {
		for (const t of [{}, { before: 'a', after: 'b' }, { before: '' }, { up: 'a' }, null]) {
			await expect(stub().move('pages', 'id1', t as never, { as: 'system' })).rejects.toThrow(wireError('QUERY'));
		}
		await stub().move('pages', 'id1', { before: 'id2' }, { as: 'system' });
		expect(calls[0]!.args[2]).toEqual({ before: 'id2' });
	});

	it('forwards depth and draft on system writes', async () => {
		await stub().update('pages', 'id1', {}, { as: 'system', depth: 1, draft: true });
		expect(calls[0]!.args[3]).toEqual({ depth: 1, draft: true, overrideAccess: true });
	});
});

describe('draft reads', () => {
	it('anonymous callers can never read drafts', async () => {
		const r = stub();
		await expect(r.find('pages', { draft: true })).rejects.toThrow(wireError('FORBIDDEN'));
		await expect(r.findOne('pages', { draft: true })).rejects.toThrow(wireError('FORBIDDEN'));
		await expect(r.findByID('pages', 'x', { draft: true })).rejects.toThrow(wireError('FORBIDDEN'));
		await expect(r.findGlobal('site', { draft: true })).rejects.toThrow(wireError('FORBIDDEN'));
		expect(calls).toEqual([]);
		expect(() => readRpcOptions({ draft: true }, ['draft', 'as'])).toThrow('needs');
	});
	it('system callers may', async () => {
		await stub().findByID('pages', 'x', { draft: true, as: 'system' });
		expect(calls[0]!.args[2]).toEqual({ draft: true, overrideAccess: true });
	});
	it('anonymous reads run without overrideAccess', async () => {
		await stub().findGlobal('site', { depth: 1 });
		expect(calls[0]!.args[1]).toEqual({ depth: 1, overrideAccess: false });
	});
});
