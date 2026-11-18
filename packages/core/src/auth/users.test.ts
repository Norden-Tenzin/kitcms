// Integration tests: real Better Auth + Drizzle + kitcms pipeline on a Miniflare D1.
// SvelteKit-only modules are mocked; `sveltekitCookies` needs a request event, so the sign-in
// success path is tested with an event whose `cookies.set` we capture.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const events: { current: unknown } = { current: undefined };
vi.mock('$app/env', () => ({ dev: true, building: false }));
vi.mock('$app/paths', () => ({ base: '', resolve: (p: string) => p }));
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
import { createD1Adapter } from '../db/d1';
import { ForbiddenError } from '../errors';
import type { KitcmsInternals } from '../sveltekit/index';
import { resolveSession } from './module';
import {
	countUsers,
	createFirstAdmin,
	createUserWithPassword,
	FirstUserError,
	setPassword,
	signIn,
	signOut,
	SignInError,
} from './users';

const config = sanitizeConfig(defineConfig({ collections: [] }));
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

function internals(user: KitcmsUser | null): KitcmsInternals {
	const db = createD1Adapter(config, tdb.d1);
	const cmsFor = (u: KitcmsUser | null, source: 'local' | 'admin' | 'rest' = 'local') =>
		createLocalApi({ config, db, user: u, source });
	return {
		config,
		options: { config: {} as never },
		db,
		env: { DB: tdb.d1, BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-1234' },
		cms: cmsFor(user),
		user,
		cmsFor,
		email: { enabled: false, send: () => Promise.reject(new Error('no email')) },
	};
}

/** A request event capturing cookies, as `sveltekitCookies` expects. */
function eventFor(headers: Record<string, string> = {}) {
	const set: { name: string; value: string; opts: Record<string, unknown> }[] = [];
	const h = new Headers({ 'cf-connecting-ip': '9.9.9.9', ...headers });
	const event = {
		url: new URL('http://localhost:5173/admin'),
		request: new Request('http://localhost:5173/admin', { headers: h }),
		cookies: {
			set: (name: string, value: string, opts: Record<string, unknown>) => set.push({ name, value, opts }),
			get: () => undefined,
			getAll: () => [],
			delete: () => {},
			serialize: () => '',
		},
	};
	events.current = event;
	return { event, set, headers: h };
}

beforeAll(async () => {
	tdb = await createTestDb(config);
});
afterAll(async () => {
	await tdb.dispose();
});

describe('createFirstAdmin', () => {
	it('creates an admin with a credential account, once', async () => {
		const k = internals(null);
		expect(await countUsers(k)).toBe(0);
		await createFirstAdmin(k, { name: ' Ada ', email: ' ADA@Example.com ', password: 'correct horse' });
		expect(await countUsers(k)).toBe(1);
		const { docs } = await k.cmsFor(null).find('users', { overrideAccess: true });
		expect(docs[0]).toMatchObject({ name: 'Ada', email: 'ada@example.com', role: 'admin' });
		const acc = await tdb.d1.prepare('select providerId, password from auth_accounts').all();
		expect(acc.results).toHaveLength(1);
		expect((acc.results[0] as { providerId: string }).providerId).toBe('credential');
		expect((acc.results[0] as { password: string }).password).not.toContain('correct horse');

		await expect(
			createFirstAdmin(k, { name: 'Eve', email: 'eve@example.com', password: 'another pass' }),
		).rejects.toMatchObject({ code: 'USERS_EXIST' });
		expect(await countUsers(k)).toBe(1);
	});

	it('rejects invalid input', async () => {
		const k = internals(null);
		await expect(createFirstAdmin(k, { name: '', email: 'a@b.co', password: 'long enough' })).rejects.toBeInstanceOf(
			FirstUserError,
		);
		await expect(createFirstAdmin(k, { name: 'A', email: 'nope', password: 'long enough' })).rejects.toMatchObject({
			code: 'INVALID',
		});
		await expect(createFirstAdmin(k, { name: 'A', email: 'a@b.co', password: 'short' })).rejects.toMatchObject({
			code: 'INVALID',
		});
	});
});

describe('createFirstAdmin race', () => {
	it('rolls back when another user appeared concurrently', async () => {
		const race = await createTestDb(config);
		try {
			const k0 = internals(null);
			const raceK: KitcmsInternals = {
				...k0,
				env: { ...k0.env, DB: race.d1 },
				db: createD1Adapter(config, race.d1),
			};
			raceK.cmsFor = (u, source = 'local') =>
				createLocalApi({ config, db: raceK.db, user: u, source });
			// Simulate the competing request: its row lands between our zero-count check and our re-count.
			const real = raceK.cmsFor;
			let created = 0;
			raceK.cmsFor = (u, source) => {
				const cms = real(u, source);
				const create = cms.create.bind(cms);
				cms.create = (async (...args: Parameters<typeof create>) => {
					const doc = await create(...args);
					if (created++ === 0) {
						await real(null).create(
							'users',
							{ name: 'Other', email: 'other@example.com', role: 'admin' },
							{ overrideAccess: true },
						);
					}
					return doc;
				}) as typeof cms.create;
				return cms;
			};
			await expect(
				createFirstAdmin(raceK, { name: 'Ada', email: 'ada@example.com', password: 'correct horse' }),
			).rejects.toMatchObject({ code: 'RACE' });
			// Our row is gone and so is its account; the competitor's row remains.
			const users = await race.d1.prepare('select email from users').all();
			expect(users.results.map((r) => (r as { email: string }).email)).toEqual(['other@example.com']);
			const accounts = await race.d1.prepare('select id from auth_accounts').all();
			expect(accounts.results).toHaveLength(0);
		} finally {
			await race.dispose();
		}
	});
});

describe('signIn / signOut / resolveSession', () => {
	it('rejects wrong credentials without distinguishing email from password', async () => {
		const k = internals(null);
		const { headers } = eventFor({ 'cf-connecting-ip': '1.1.1.1' });
		await expect(signIn(k, { email: 'ada@example.com', password: 'wrong wrong', headers })).rejects.toMatchObject({
			code: 'INVALID_CREDENTIALS',
		});
		await expect(signIn(k, { email: 'nobody@example.com', password: 'wrong wrong', headers })).rejects.toMatchObject({
			code: 'INVALID_CREDENTIALS',
		});
	});

	it('signs in, sets the session cookie (httpOnly, not Secure on loopback http), resolves the session, signs out', async () => {
		const k = internals(null);
		const { set, headers, event } = eventFor({ 'cf-connecting-ip': '2.2.2.2' });
		const user = await signIn(k, { email: 'ADA@example.com ', password: 'correct horse', headers });
		expect(user).toMatchObject({ email: 'ada@example.com', role: 'admin', collection: 'users' });
		expect(JSON.stringify(user)).not.toMatch(/password|token/);
		const cookie = set.find((c) => c.name.includes('session_token'));
		expect(cookie).toBeDefined();
		expect(cookie?.opts).toMatchObject({ httpOnly: true, sameSite: 'lax' });
		expect(cookie?.opts.secure).toBeFalsy();

		const cookieHeader = `${cookie!.name}=${encodeURIComponent(cookie!.value)}`;
		const authed = eventFor({ cookie: cookieHeader, 'cf-connecting-ip': '2.2.2.2' });
		const resolved = await resolveSession(authed.event as never, k);
		expect(resolved?.user).toEqual(user);
		expect(Object.keys(resolved!.session).sort()).toEqual(['expiresAt', 'id']);

		await signOut(k, authed.headers);
		expect(await resolveSession(authed.event as never, k)).toBeNull();
		void event;
	});

	it('rate-limits server-side sign-ins per email, then per ip', async () => {
		const k = internals(null);
		const { headers } = eventFor({ 'cf-connecting-ip': '3.3.3.3' });
		const attempt = () => signIn(k, { email: 'victim@example.com', password: 'wrong wrong', headers });
		for (let i = 0; i < 5; i++) await expect(attempt()).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
		const err = await attempt().catch((e: unknown) => e);
		expect(err).toBeInstanceOf(SignInError);
		expect(err).toMatchObject({ code: 'RATE_LIMITED' });
		expect((err as SignInError).retryAfter).toBeGreaterThan(0);
		// Even the correct password is refused while limited.
		await expect(
			signIn(k, { email: 'victim@example.com', password: 'correct horse', headers }),
		).rejects.toMatchObject({ code: 'RATE_LIMITED' });
		// Same IP, other email: the IP bucket (also 5/min) is exhausted too.
		await expect(
			signIn(k, { email: 'other2@example.com', password: 'wrong wrong', headers }),
		).rejects.toMatchObject({ code: 'RATE_LIMITED' });
		// A different IP and email is unaffected.
		const other = eventFor({ 'cf-connecting-ip': '4.4.4.4' });
		await expect(
			signIn(k, { email: 'other3@example.com', password: 'wrong wrong', headers: other.headers }),
		).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
	});
});

describe('createUserWithPassword', () => {
	const adminUser = async () => {
		const k = internals(null);
		const { docs } = await k.cmsFor(null).find('users', { overrideAccess: true, where: { role: { equals: 'admin' } } });
		const d = docs[0] as unknown as { id: string; email: string; name: string; role: string };
		return internals({ id: d.id, email: d.email, name: d.name, role: d.role, collection: 'users' });
	};

	it('lets an admin create a user who can then sign in', async () => {
		const k = await adminUser();
		const { id } = await createUserWithPassword(k, {
			name: 'Ed',
			email: 'Ed@Example.com',
			password: 'editor pass 1',
			role: 'editor',
		});
		expect(id).toBeTruthy();
		const { headers } = eventFor({ 'cf-connecting-ip': '5.5.5.5' });
		const u = await signIn(internals(null), { email: 'ed@example.com', password: 'editor pass 1', headers });
		expect(u).toMatchObject({ id, role: 'editor' });
	});

	it('denies editors and anonymous callers, and leaves no row behind', async () => {
		const before = await countUsers(internals(null));
		const ed = internals({ id: 'x', email: 'ed@example.com', name: 'Ed', role: 'editor', collection: 'users' });
		await expect(
			createUserWithPassword(ed, { name: 'Z', email: 'z@example.com', password: 'zzzzzzzz' }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(
			createUserWithPassword(internals(null), { name: 'Z', email: 'z@example.com', password: 'zzzzzzzz' }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(await countUsers(internals(null))).toBe(before);
	});

	it('rejects a short password before creating anything', async () => {
		const k = await adminUser();
		const before = await countUsers(k);
		await expect(createUserWithPassword(k, { name: 'S', email: 's@example.com', password: 'abc' })).rejects.toMatchObject({
			code: 'VALIDATION',
		});
		expect(await countUsers(k)).toBe(before);
	});
});

describe('setPassword', () => {
	async function userByEmail(email: string): Promise<KitcmsUser> {
		const k = internals(null);
		const { docs } = await k.cmsFor(null).find('users', { overrideAccess: true, where: { email: { equals: email } } });
		const d = docs[0] as unknown as { id: string; email: string; name: string; role: string };
		return { id: d.id, email: d.email, name: d.name, role: d.role, collection: 'users' };
	}
	const login = (email: string, password: string, ip: string) =>
		signIn(internals(null), { email, password, headers: eventFor({ 'cf-connecting-ip': ip }).headers });

	it('a user changes their own password only with the correct current one', async () => {
		const ed = await userByEmail('ed@example.com');
		const k = internals(ed);
		await expect(setPassword(k, { userId: ed.id, newPassword: 'brand new pass' })).rejects.toBeInstanceOf(ForbiddenError);
		await expect(
			setPassword(k, { userId: ed.id, newPassword: 'brand new pass', currentPassword: 'nope nope' }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(
			setPassword(k, { userId: ed.id, newPassword: 'x', currentPassword: 'editor pass 1' }),
		).rejects.toMatchObject({ code: 'VALIDATION' });

		await setPassword(k, { userId: ed.id, newPassword: 'brand new pass', currentPassword: 'editor pass 1', headers: eventFor().headers });
		await expect(login('ed@example.com', 'editor pass 1', '6.6.6.1')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
		await expect(login('ed@example.com', 'brand new pass', '6.6.6.2')).resolves.toMatchObject({ id: ed.id });
	});

	it('an editor cannot change someone else, an admin can, and sessions are revoked', async () => {
		const ed = await userByEmail('ed@example.com');
		const ada = await userByEmail('ada@example.com');
		await expect(
			setPassword(internals(ed), { userId: ada.id, newPassword: 'hijack hijack', currentPassword: 'brand new pass' }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(setPassword(internals(null), { userId: ada.id, newPassword: 'hijack hijack' })).rejects.toBeInstanceOf(
			ForbiddenError,
		);

		const sessionsBefore = await tdb.d1.prepare('select id from auth_sessions where userId = ?').bind(ed.id).all();
		expect(sessionsBefore.results.length).toBeGreaterThan(0);
		await setPassword(internals(ada), { userId: ed.id, newPassword: 'admin chosen pass' });
		const sessionsAfter = await tdb.d1.prepare('select id from auth_sessions where userId = ?').bind(ed.id).all();
		expect(sessionsAfter.results).toHaveLength(0);
		await expect(login('ed@example.com', 'admin chosen pass', '7.7.7.1')).resolves.toMatchObject({ id: ed.id });
	});

	it('an admin changing their OWN password still needs the current one (stolen-cookie defence)', async () => {
		const ada = await userByEmail('ada@example.com');
		await expect(
			setPassword(internals(ada), { userId: ada.id, newPassword: 'takeover pass' }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(
			setPassword(internals(ada), { userId: ada.id, newPassword: 'takeover pass', currentPassword: 'wrong wrong' }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
