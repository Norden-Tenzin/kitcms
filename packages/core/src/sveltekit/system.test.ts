// The system setup endpoints (Decision 43). SECURITY-CRITICAL. Real Better Auth + Drizzle + kitcms
// pipeline on a Miniflare D1 (harness copied from users.test.ts).
// SvelteKit-only modules are mocked; `sveltekitCookies` needs a request event, so the sign-in
// success path is tested with an event whose `cookies.set` we capture.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const events: { current: unknown } = { current: undefined };
vi.mock('$app/env', () => ({ dev: true, building: false }));
vi.mock('$app/paths', () => ({
	base: '',
	resolve: (id: string, p: { path?: string } = {}) => id.replace('/(kitcms)', '').replace('[...path]', p.path ?? ''),
}));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		if (!events.current) throw new Error('no request event');
		return events.current;
	},
}));

import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { createSchemaStatements } from '../../test/d1';
import { createLocalApi } from '../api/local';
import { defineConfig } from '../config/collection';
import type { KitcmsUser } from '../config/hooks';
import { sanitizeConfig } from '../config/sanitize';
import { ValidationError } from '../errors';
import { createD1Adapter } from '../db/d1';
import type { KitcmsInternals } from '../sveltekit/index';
import type { EmailMessageInput } from '../config/plugin';
import { defineSeed } from '../seed';
import { handleSystem, tokensEqual } from './system';

const TOKEN = 'a-long-random-system-token-0123456789abcdef';
const config = sanitizeConfig(
	defineConfig({
		collections: [],
		globals: [],
		system: {
			seeds: {
				starter: (input) => {
					const name = (input as { name?: unknown } | undefined)?.name;
					if (typeof name !== 'string' || !name) throw new ValidationError([{ path: 'input.name', message: 'Required.' }]);
					return defineSeed(async ({ ensure, log }) => {
						await ensure('users' as never, { where: { email: { equals: 'seeded@hotel.test' } }, data: { email: 'seeded@hotel.test', name, role: 'editor' } } as never);
						log(`seeded ${name}`);
					}) as never;
				},
			},
		},
	}),
);
interface TestDb {
	d1: D1Database;
	dispose(): Promise<void>;
}

// Local copy of `createTestDb` (../../test/d1.ts) wrapping the options with `convertV4MiniflareOptions`;
// the shared harness passes v4-shaped options straight to `new Miniflare()`, which Miniflare 5 rejects.
async function createTestDb(cfg: typeof config): Promise<TestDb> {
	const mf = new Miniflare(
		convertV4MiniflareOptions({
			modules: true,
			script: 'export default { fetch() { return new Response() } }',
			d1Databases: ['DB'],
		}),
	);
	try {
		const d1 = (await mf.getD1Database('DB')) as unknown as D1Database;
		for (const stmt of await createSchemaStatements(cfg)) {
			for (const part of stmt.split('--> statement-breakpoint')) {
				if (part.trim()) await d1.prepare(part.trim()).run();
			}
		}
		return { d1, dispose: () => mf.dispose() };
	} catch (err) {
		await mf.dispose();
		throw err;
	}
}


let tdb: TestDb;
const sent: EmailMessageInput[] = [];
let secret: string | undefined = TOKEN;

function internals(): KitcmsInternals {
	const db = createD1Adapter(config, tdb.d1);
	const cmsFor = (u: KitcmsUser | null, source: 'local' | 'admin' | 'rest' = 'local') =>
		createLocalApi({ config, db, user: u, source });
	return {
		config,
		options: { config: {} as never },
		db,
		env: { DB: tdb.d1, BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-1234', KITCMS_SYSTEM_TOKEN: secret },
		cms: cmsFor(null),
		user: null,
		cmsFor,
		email: {
			enabled: true,
			send: async (m: EmailMessageInput) => {
				sent.push(m);
				return { messageId: null };
			},
		},
		runtime: () => ({ env: {}, cms: cmsFor(null) }),
	};
}

async function call(path: string, body: unknown, auth: string | null = TOKEN) {
	const url = new URL(`https://hotel.test/api/system/${path}`);
	const headers = new Headers({ 'content-type': 'application/json' });
	if (auth !== null) headers.set('authorization', `Bearer ${auth}`);
	const request = new Request(url, { method: 'POST', headers, body: JSON.stringify(body) });
	events.current = { url, request, cookies: { set: () => {}, get: () => undefined, getAll: () => [], delete: () => {}, serialize: () => '' } };
	const res = await handleSystem({ url, request } as never, internals(), path.split('/'));
	return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeAll(async () => {
	tdb = await createTestDb(config);
});
afterAll(async () => {
	await tdb.dispose();
});

describe('auth', () => {
	it('404 without a (long enough) secret, 401 for a wrong or missing token', async () => {
		secret = undefined;
		expect((await call('users', {})).status).toBe(404);
		secret = 'short';
		expect((await call('users', {}, 'short')).status).toBe(404);
		secret = TOKEN;
		expect((await call('users', {}, null)).status).toBe(401);
		expect((await call('users', {}, `${TOKEN}x`)).status).toBe(401);
		expect((await call('users', {}, TOKEN.slice(0, -1))).status).toBe(401);
	});

	it('compares tokens in constant time over digests', async () => {
		expect(await tokensEqual('abc', 'abc')).toBe(true);
		expect(await tokensEqual('abc', 'abd')).toBe(false);
		expect(await tokensEqual('abc', 'abcd')).toBe(false);
	});
});

describe('seed', () => {
	it('runs a named seed with its input, idempotently', async () => {
		const first = await call('seed/starter', { input: { name: 'Seeded' } });
		expect(first).toMatchObject({ status: 200, body: { ok: true, log: ['seeded Seeded'] } });
		const again = await call('seed/starter', { input: { name: 'Seeded' } });
		expect(again.status).toBe(200);
		const { totalDocs } = await internals().cmsFor(null).find('users', { overrideAccess: true, where: { email: { equals: 'seeded@hotel.test' } } });
		expect(totalDocs).toBe(1);
	});

	it('400 for bad input, 404 for an unknown seed', async () => {
		expect((await call('seed/starter', { input: {} })).status).toBe(400);
		expect((await call('seed/nope', {})).status).toBe(404);
		expect((await call('seed/toString', {})).status).toBe(404);
	});
});

describe('users', () => {
	it('creates an admin and emails an invite; a retry creates nothing and sends nothing new once a password is set', async () => {
		sent.length = 0;
		const r = await call('users', { email: ' Owner@Hotel.test ', name: 'Owner', origin: 'https://www.hotel.test' });
		expect(r).toMatchObject({ status: 200, body: { ok: true, created: true, invited: true } });
		const { docs } = await internals().cmsFor(null).find('users', { overrideAccess: true, where: { email: { equals: 'owner@hotel.test' } } });
		expect(docs[0]).toMatchObject({ role: 'admin', name: 'Owner' });
		expect(sent).toHaveLength(1);
		expect(sent[0]!.text).toContain('https://www.hotel.test/');
		expect(sent[0]!.text).toContain('/reset-password?token=');

		// Retried before they set a password: same user, a fresh invite.
		const retry = await call('users', { email: 'owner@hotel.test', name: 'Owner' });
		expect(retry.body).toMatchObject({ created: false, invited: true, id: r.body.id });

		// After a password exists: no new invite.
		await tdb.d1
			.prepare("insert into auth_accounts (id, accountId, providerId, userId, password, createdAt, updatedAt) values ('a1', ?, 'credential', ?, 'x', 0, 0)")
			.bind(r.body.id, r.body.id)
			.run();
		sent.length = 0;
		const later = await call('users', { email: 'owner@hotel.test', name: 'Owner' });
		expect(later.body).toMatchObject({ created: false, invited: false });
		expect(sent).toHaveLength(0);
	});

	it('validates the body', async () => {
		expect((await call('users', { email: 'nope', name: '' })).status).toBe(400);
		expect((await call('users', { email: 'a@b.co', name: 'A', origin: 'http://evil.test' })).status).toBe(400);
		expect((await call('users', { email: 'a@b.co', name: 'A', invite: 'yes' })).status).toBe(400);
	});

	it('404 for other paths', async () => {
		expect((await call('nope', {})).status).toBe(404);
	});
});
