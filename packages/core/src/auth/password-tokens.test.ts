// Password reset and invite links (Decision 37). SECURITY-CRITICAL. Real Better Auth + Drizzle +
// kitcms pipeline on a Miniflare D1 (harness copied from users.test.ts).
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
import type { KitcmsInternals } from '../sveltekit/index';
import type { EmailMessageInput } from '../config/plugin';
import { createFirstAdmin, createUserWithPassword, signIn } from './users';
import { createUserWithInvite, forgotPassword, resetPassword } from './module-admin';
import { issuePasswordToken, peekPasswordToken, PASSWORD_TOKEN_TTL } from './password-tokens';

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
const sent: EmailMessageInput[] = [];
let emailOn = true;

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
		email: {
			get enabled() {
				return emailOn;
			},
			send: async (m: EmailMessageInput) => {
				sent.push(m);
				return { messageId: null };
			},
		},
		runtime: () => ({ env: {}, cms: cmsFor(null) }),
	};
}

function event(ip = '7.7.7.7') {
	const h = new Headers({ 'cf-connecting-ip': ip });
	events.current = {
		url: new URL('http://localhost:5173/admin'),
		request: new Request('http://localhost:5173/admin', { headers: h }),
		cookies: { set: () => {}, get: () => undefined, getAll: () => [], delete: () => {}, serialize: () => '' },
	};
	return h;
}

const link = (token: string) => `https://hotel.test/admin/reset-password?token=${token}`;
const tokenIn = (m: EmailMessageInput) => /token=([A-Za-z0-9_-]+)/.exec(m.text)![1]!;
let adminUser: KitcmsUser;
let ip = 0;
const nextIp = () => `10.0.0.${++ip}`;

beforeAll(async () => {
	tdb = await createTestDb(config);
	event();
	await createFirstAdmin(internals(null), { name: 'Ada', email: 'ada@hotel.test', password: 'first password' });
	const { docs } = await internals(null).cmsFor(null).find('users', { overrideAccess: true });
	adminUser = { id: docs[0]!.id as string, email: 'ada@hotel.test', name: 'Ada', role: 'admin', collection: 'users' };
});
afterAll(async () => {
	await tdb.dispose();
});

const stored = async () =>
	(await tdb.d1.prepare("select identifier, value from auth_verifications where identifier like 'kitcms-pw:%'").all()).results as {
		identifier: string;
		value: string;
	}[];

describe('forgot password', () => {
	it('emails a one-hour link to an existing admin, storing only a hash of the token', async () => {
		sent.length = 0;
		const r = await forgotPassword(internals(null), { email: ' ADA@hotel.test ', ip: nextIp(), link, title: 'Hotel' });
		expect(r).toEqual({ ok: true });
		expect(sent).toHaveLength(1);
		expect(sent[0]!.to).toBe('ada@hotel.test');
		expect(sent[0]!.subject).toBe('Reset your password for Hotel');
		const token = tokenIn(sent[0]!);
		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		const rows = await stored();
		expect(rows).toHaveLength(1);
		expect(rows[0]!.identifier).not.toContain(token);
		expect(JSON.stringify(rows)).not.toContain(token);
		expect(await peekPasswordToken(internals(null), token)).toEqual({ kind: 'reset', email: 'ada@hotel.test' });
	});

	it('answers the same for an unknown email and sends nothing', async () => {
		sent.length = 0;
		expect(await forgotPassword(internals(null), { email: 'nobody@hotel.test', ip: nextIp(), link, title: 'Hotel' })).toEqual({ ok: true });
		expect(sent).toHaveLength(0);
	});

	it('is rate limited per email and per IP', async () => {
		const k = internals(null);
		const same = nextIp();
		const results = [];
		for (let i = 0; i < 6; i++) results.push((await forgotPassword(k, { email: 'x@hotel.test', ip: same, link, title: 'H' })).ok);
		expect(results.slice(0, 5).every(Boolean)).toBe(true);
		expect(results[5]).toBe(false);
	});

	it('says so when email is off, without touching accounts', async () => {
		emailOn = false;
		try {
			const r = await forgotPassword(internals(null), { email: 'ada@hotel.test', ip: nextIp(), link, title: 'H' });
			expect(r).toMatchObject({ ok: false, status: 503 });
		} finally {
			emailOn = true;
		}
	});
});

describe('reset with a token', () => {
	it('sets the password once, revokes sessions and older links, then the link is dead', async () => {
		const k = internals(null);
		// A live session for the admin.
		const h = event();
		await signIn(k, { email: 'ada@hotel.test', password: 'first password', headers: h });
		const before = await tdb.d1.prepare('select count(*) n from auth_sessions').first<{ n: number }>();
		expect(before!.n).toBeGreaterThan(0);

		const older = await issuePasswordToken(k, adminUser.id, 'reset');
		const token = await issuePasswordToken(k, adminUser.id, 'reset');
		// Issuing a new link kills the older one.
		expect(await peekPasswordToken(k, older)).toBeNull();

		const ok = await resetPassword(k, { token, newPassword: 'second password', ip: nextIp() });
		expect(ok).toEqual({ ok: true, email: 'ada@hotel.test' });
		const after = await tdb.d1.prepare('select count(*) n from auth_sessions').first<{ n: number }>();
		expect(after!.n).toBe(0);
		expect(await stored()).toHaveLength(0);

		// Single use.
		expect(await resetPassword(k, { token, newPassword: 'third password', ip: nextIp() })).toMatchObject({ ok: false, status: 400 });
		// The new password works, the old one doesn't.
		event();
		await expect(signIn(k, { email: 'ada@hotel.test', password: 'first password', headers: event(nextIp()) })).rejects.toThrow();
		await expect(signIn(k, { email: 'ada@hotel.test', password: 'second password', headers: event(nextIp()) })).resolves.toMatchObject({
			email: 'ada@hotel.test',
		});
	});

	it('rejects malformed, unknown and expired tokens, and short passwords', async () => {
		const k = internals(null);
		expect(await resetPassword(k, { token: 'short', newPassword: 'long enough', ip: nextIp() })).toMatchObject({ ok: false, status: 400 });
		expect(await resetPassword(k, { token: 'A'.repeat(43), newPassword: 'long enough', ip: nextIp() })).toMatchObject({ ok: false, status: 400 });
		const token = await issuePasswordToken(k, adminUser.id, 'reset');
		expect(await resetPassword(k, { token, newPassword: 'short', ip: nextIp() })).toMatchObject({ ok: false, status: 400 });
		// The failed attempt (bad password) didn't use the link up.
		expect(await peekPasswordToken(k, token)).not.toBeNull();
		await tdb.d1.prepare("update auth_verifications set expiresAt = ? where identifier like 'kitcms-pw:%'").bind(Date.now() - 1000).run();
		expect(await peekPasswordToken(k, token)).toBeNull();
		expect(await resetPassword(k, { token, newPassword: 'long enough', ip: nextIp() })).toMatchObject({ ok: false, status: 400 });
	});

	it('only one of two concurrent uses wins', async () => {
		const k = internals(null);
		const token = await issuePasswordToken(k, adminUser.id, 'reset');
		const results = await Promise.all([
			resetPassword(k, { token, newPassword: 'race one!', ip: nextIp() }),
			resetPassword(k, { token, newPassword: 'race two!', ip: nextIp() }),
		]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
	});

	it('tokens are typed: invites last 7 days, resets 1 hour', () => {
		expect(PASSWORD_TOKEN_TTL.reset).toBe(3600_000);
		expect(PASSWORD_TOKEN_TTL.invite).toBe(7 * 24 * 3600_000);
	});
});

describe('invite', () => {
	it('creates a user without a password and emails a 7-day link that sets one', async () => {
		sent.length = 0;
		const k = internals(adminUser);
		const { id } = await createUserWithInvite(k, { name: 'Tenzin', email: ' Tenzin@Hotel.test ', role: 'editor' }, { link, title: 'Hotel' });
		const acc = await tdb.d1.prepare('select count(*) n from auth_accounts where userId = ?').bind(id).first<{ n: number }>();
		expect(acc!.n).toBe(0);
		expect(sent).toHaveLength(1);
		expect(sent[0]!.to).toBe('tenzin@hotel.test');
		expect(sent[0]!.subject).toBe('Set your password for Hotel');
		const token = tokenIn(sent[0]!);
		expect(await peekPasswordToken(k, token)).toEqual({ kind: 'invite', email: 'tenzin@hotel.test' });
		expect(await resetPassword(internals(null), { token, newPassword: 'tenzin password', ip: nextIp() })).toMatchObject({ ok: true });
		await expect(signIn(k, { email: 'tenzin@hotel.test', password: 'tenzin password', headers: event(nextIp()) })).resolves.toBeTruthy();
	});

	it('uses the caller access: an editor cannot invite', async () => {
		const k = internals({ ...adminUser, id: 'someone', role: 'editor' });
		await expect(createUserWithInvite(k, { name: 'Eve', email: 'eve@hotel.test' }, { link, title: 'H' })).rejects.toThrow();
	});

	it('refuses when email is off, and removes the user if the email fails', async () => {
		emailOn = false;
		try {
			await expect(createUserWithInvite(internals(adminUser), { name: 'N', email: 'n@hotel.test' }, { link, title: 'H' })).rejects.toMatchObject({
				errors: [{ message: expect.stringMatching(/Email is not set up/) }],
			});
		} finally {
			emailOn = true;
		}
		const k = internals(adminUser);
		const failing = { ...k, email: { enabled: true, send: () => Promise.reject(new Error('smtp down')) } };
		await expect(createUserWithInvite(failing, { name: 'M', email: 'm@hotel.test' }, { link, title: 'H' })).rejects.toThrow('smtp down');
		const { totalDocs } = await k.cmsFor(null).find('users', { overrideAccess: true, where: { email: { equals: 'm@hotel.test' } } });
		expect(totalDocs).toBe(0);
	});

	it('a password set through the admin flow still works alongside', async () => {
		const k = internals(adminUser);
		await createUserWithPassword(k, { name: 'P', email: 'p@hotel.test', password: 'p password!' });
		expect((await forgotPassword(internals(null), { email: 'p@hotel.test', ip: nextIp(), link, title: 'H' })).ok).toBe(true);
	});
});
