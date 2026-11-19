// RPC option whitelisting (security-critical, plan §2.2 trust model).
import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ WorkerEntrypoint: class {} }));
vi.mock('../runtime', () => ({ dbFor: vi.fn(), storageFor: vi.fn(), isReadOnly: () => false }));

const { readRpcOptions } = await import('./index');
const ALL = ['where', 'sort', 'limit', 'page', 'depth', 'pagination', 'as'] as const;

describe('readRpcOptions', () => {
	it('defaults to anonymous with no options', () => {
		expect(readRpcOptions(undefined, ALL)).toEqual({ system: false, args: {} });
		expect(readRpcOptions(null, ALL)).toEqual({ system: false, args: {} });
	});

	it('copies whitelisted keys only', () => {
		const r = readRpcOptions({ where: { a: { equals: 1 } }, sort: '-x', limit: 5, page: 2, depth: 1 }, ALL);
		expect(r).toEqual({
			system: false,
			args: { where: { a: { equals: 1 } }, sort: '-x', limit: 5, page: 2, depth: 1 },
		});
	});

	it('`as: "system"` is the only way to become trusted', () => {
		expect(readRpcOptions({ as: 'system' }, ALL).system).toBe(true);
		expect(() => readRpcOptions({ as: 'admin' }, ALL)).toThrow('`as` must be "system"');
		expect(() => readRpcOptions({ as: true }, ALL)).toThrow();
	});

	it('never passes privileged Local API options through', () => {
		for (const key of ['overrideAccess', 'req', 'context', 'user', '__proto__x']) {
			expect(() => readRpcOptions({ [key]: true }, ALL)).toThrow(`Unknown option "${key}"`);
		}
	});

	it('ignores a polluted prototype', () => {
		const opts = Object.create({ overrideAccess: true }) as Record<string, unknown>;
		expect(() => readRpcOptions(opts, ALL)).toThrow('options must be an object');
		const nullProto = Object.assign(Object.create(null) as object, { limit: 1 });
		expect(readRpcOptions(nullProto, ALL).args).toEqual({ limit: 1 });
	});

	it('respects the per-method whitelist', () => {
		expect(() => readRpcOptions({ limit: 5 }, ['depth', 'as'])).toThrow('Unknown option "limit"');
	});

	it('type-checks values', () => {
		expect(() => readRpcOptions({ where: 'x' }, ALL)).toThrow();
		expect(() => readRpcOptions({ where: [] }, ALL)).toThrow();
		expect(() => readRpcOptions({ sort: 1 }, ALL)).toThrow();
		expect(() => readRpcOptions({ limit: '5' }, ALL)).toThrow();
		expect(() => readRpcOptions({ pagination: 'no' }, ALL)).toThrow();
		expect(() => readRpcOptions('x', ALL)).toThrow();
	});
});
