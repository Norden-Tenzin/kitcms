import { describe, expect, it, vi } from 'vitest';
import { isKitcmsClientError, kitcms, KitcmsClientError, parseKitcmsError, type KitcmsBinding } from './index';

function fake(over: Partial<KitcmsBinding> = {}): KitcmsBinding & { calls: [string, unknown[]][] } {
	const calls: [string, unknown[]][] = [];
	const rec =
		<R>(name: string, result: R) =>
		async (...args: unknown[]) => {
			calls.push([name, args]);
			return result;
		};
	return {
		calls,
		find: rec('find', { docs: [] }),
		findOne: rec('findOne', null),
		findByID: rec('findByID', null),
		count: rec('count', 3),
		getMediaUrl: rec('getMediaUrl', 'https://x/y'),
		...over,
	} as never;
}

describe('parseKitcmsError', () => {
	it('parses the wire format', () => {
		const e = parseKitcmsError(new Error('kitcms:FORBIDDEN:403: Not allowed: really'));
		expect(e).toBeInstanceOf(KitcmsClientError);
		expect(e).toMatchObject({ code: 'FORBIDDEN', status: 403, message: 'Not allowed: really' });
		expect(isKitcmsClientError(e)).toBe(true);
	});
	it('tolerates a prefix and leaves other errors alone', () => {
		expect(parseKitcmsError(new Error('Error: kitcms:QUERY:400: bad'))).toMatchObject({ code: 'QUERY', status: 400, message: 'bad' });
		const other = new Error('boom');
		expect(parseKitcmsError(other)).toBe(other);
		expect(parseKitcmsError('str')).toBe('str');
		expect(parseKitcmsError(new Error('kitcms: nothing'))).toBeInstanceOf(Error);
	});
});

describe('kitcms()', () => {
	it('forwards every method with options untouched', async () => {
		const b = fake();
		const cms = kitcms(b);
		const opts = { where: { a: { equals: 1 } }, sort: '-a', limit: 2, as: 'system' as const, extra: 1 };
		await cms.find('posts', opts as never);
		await cms.findOne('posts', opts as never);
		await cms.findByID('posts', 'id1', { depth: 2 });
		await cms.count('posts', { where: {} });
		expect(await cms.getMediaUrl('k')).toBe('https://x/y');
		expect(b.calls[0]).toEqual(['find', ['posts', opts]]);
		expect(b.calls[0]![1][1]).toBe(opts);
		expect(b.calls[1]).toEqual(['findOne', ['posts', opts]]);
		expect(b.calls[2]).toEqual(['findByID', ['posts', 'id1', { depth: 2 }]]);
		expect(b.calls[3]).toEqual(['count', ['posts', { where: {} }]]);
		expect(b.calls[4]).toEqual(['getMediaUrl', ['k']]);
	});
	it('passes undefined options through', async () => {
		const b = fake();
		await kitcms(b).find('posts');
		expect(b.calls[0]).toEqual(['find', ['posts', undefined]]);
	});
	it('wraps kitcms errors and rethrows others as-is', async () => {
		const boom = new TypeError('network');
		const cms = kitcms(
			fake({
				find: vi.fn().mockRejectedValue(new Error('kitcms:NOT_FOUND:404: nope')),
				count: vi.fn().mockRejectedValue(boom),
			}),
		);
		await expect(cms.find('x')).rejects.toMatchObject({ name: 'KitcmsClientError', code: 'NOT_FOUND', status: 404, message: 'nope' });
		await expect(cms.count('x')).rejects.toBe(boom);
	});
	it('wraps synchronous throws too', async () => {
		const cms = kitcms(
			fake({
				findByID: (() => {
					throw new Error('kitcms:QUERY:400: sync');
				}) as never,
			}),
		);
		await expect(cms.findByID('x', '1')).rejects.toMatchObject({ code: 'QUERY' });
	});
});
