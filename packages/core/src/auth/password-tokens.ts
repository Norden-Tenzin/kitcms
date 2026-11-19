// Password reset and invite links (plan §8 of the platform; kitcms Decision 37). SECURITY-CRITICAL.
//
// A link carries a random 256-bit token. Only its SHA-256 lands in `auth_verifications` (identifier
// `kitcms-pw:<hex>`), so a database leak reveals no usable link. A token is single-use (deleted
// before the password is set), expires (reset 1 hour, invite 7 days), and setting a password deletes
// the user's other outstanding tokens and revokes all of their sessions.
//
// "Forgot password" never says whether an account exists: the caller always shows the same message.
// Requests are rate-limited per IP and per email in D1, failing closed like sign-in.
import { and, eq, gt, like, lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { adminAccess } from '../access/engine';
import { ValidationError } from '../errors';
import { getTables, type AnyTable } from '../schema/drizzle';
import { AUTH_TABLES } from '../schema/spec';
import type { KitcmsInternals } from '../sveltekit/index';
import { ulid } from '../ulid';
import { getD1 } from './better-auth';
import { consume, normalizeEmail, type AuthDb, type RateRule } from './rate-limit';
import { toKitcmsUser } from './session';
import { authContext } from './users';

export type PasswordTokenKind = 'reset' | 'invite';

export const PASSWORD_TOKEN_TTL: Record<PasswordTokenKind, number> = {
	reset: 60 * 60 * 1000,
	invite: 7 * 24 * 60 * 60 * 1000,
};

const PREFIX = 'kitcms-pw:';
/** Per IP and per email: a few requests an hour is plenty for a human. */
export const RESET_REQUEST_RULE: RateRule = { max: 5, window: 60 * 60 };
/** Attempts to use a link, per IP. */
export const RESET_USE_RULE: RateRule = { max: 10, window: 15 * 60 };

const enc = new TextEncoder();

async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Tokens are base64url, 43 characters. Anything else is rejected before touching D1. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

function authDb(k: KitcmsInternals): AuthDb {
	return drizzle(getD1(k)) as unknown as AuthDb;
}

function table(k: KitcmsInternals, name: string): AnyTable {
	return getTables(k.config)[name]!;
}

/** `value` column: who the token is for and what it does. User ids are ULIDs (no quotes or `%`). */
const encodeValue = (userId: string, kind: PasswordTokenKind) => JSON.stringify({ u: userId, k: kind });

function decodeValue(value: unknown): { userId: string; kind: PasswordTokenKind } | null {
	try {
		const v = JSON.parse(String(value)) as { u?: unknown; k?: unknown };
		if (typeof v.u !== 'string' || (v.k !== 'reset' && v.k !== 'invite')) return null;
		return { userId: v.u, kind: v.k };
	} catch {
		return null;
	}
}

/** Deletes every outstanding password token of a user (and, opportunistically, expired ones). */
async function deleteTokensOf(k: KitcmsInternals, userId: string): Promise<void> {
	const t = table(k, AUTH_TABLES.verification);
	const db = authDb(k);
	await db.delete(t).where(and(like(t.identifier, `${PREFIX}%`), like(t.value, `%"u":"${userId}"%`)));
	await db.delete(t).where(and(like(t.identifier, `${PREFIX}%`), lt(t.expiresAt, new Date())));
}

/** Creates a token for `userId` and returns it (to put in a link). Earlier tokens of the user stop working. */
export async function issuePasswordToken(k: KitcmsInternals, userId: string, kind: PasswordTokenKind): Promise<string> {
	if (!/^[A-Za-z0-9]+$/.test(userId)) throw new Error('kitcms: unexpected user id.');
	await deleteTokensOf(k, userId);
	const token = randomToken();
	const now = Date.now();
	await authDb(k)
		.insert(table(k, AUTH_TABLES.verification))
		.values({
			id: ulid(now),
			identifier: PREFIX + (await sha256Hex(token)),
			value: encodeValue(userId, kind),
			expiresAt: new Date(now + PASSWORD_TOKEN_TTL[kind]),
			createdAt: new Date(now),
			updatedAt: new Date(now),
		});
	return token;
}

interface TokenRow {
	id: string;
	userId: string;
	kind: PasswordTokenKind;
}

async function findRow(k: KitcmsInternals, token: string): Promise<TokenRow | null> {
	if (!TOKEN_RE.test(token)) return null;
	const t = table(k, AUTH_TABLES.verification);
	const [row] = (await authDb(k)
		.select()
		.from(t)
		.where(and(eq(t.identifier, PREFIX + (await sha256Hex(token))), gt(t.expiresAt, new Date())))
		.limit(1)) as { id: string; value: string }[];
	const decoded = row ? decodeValue(row.value) : null;
	return row && decoded ? { id: row.id, ...decoded } : null;
}

async function userById(k: KitcmsInternals, id: string): Promise<Record<string, unknown> | null> {
	return (await k.cmsFor(null).findByID(k.config.authCollection, id, { overrideAccess: true })) as Record<string, unknown> | null;
}

/** What a valid link is for (the reset page shows "set" vs "choose a new" password), or `null`. Doesn't use it up. */
export async function peekPasswordToken(
	k: KitcmsInternals,
	token: string,
): Promise<{ kind: PasswordTokenKind; email: string } | null> {
	const row = await findRow(k, token);
	if (!row) return null;
	const user = await userById(k, row.userId);
	return user && typeof user.email === 'string' ? { kind: row.kind, email: user.email } : null;
}

export class PasswordTokenError extends Error {
	constructor(
		readonly code: 'INVALID_TOKEN' | 'RATE_LIMITED',
		message: string,
	) {
		super(message);
		this.name = 'PasswordTokenError';
	}
}

/**
 * Sets the password of the token's user. The token is deleted first (single use, even if what
 * follows fails), then the password is set, the user's other tokens are deleted and ALL their
 * sessions are revoked. Returns the user's email (to sign them in).
 */
export async function resetPasswordWithToken(
	k: KitcmsInternals,
	input: { token: string; newPassword: string; ip: string | null },
): Promise<{ email: string }> {
	const ctx = await authContext(k);
	const { minPasswordLength, maxPasswordLength } = ctx.password.config;
	const pw = input.newPassword;
	if (typeof pw !== 'string' || pw.length < minPasswordLength || pw.length > maxPasswordLength) {
		throw new ValidationError([
			{ path: 'password', message: `Password must be ${minPasswordLength} to ${maxPasswordLength} characters.` },
		]);
	}
	if (input.ip) {
		const limit = await consume(authDb(k), table(k, AUTH_TABLES.rateLimit), `kitcms:pwuse:ip:${input.ip}`, RESET_USE_RULE);
		if (!limit.allowed) throw new PasswordTokenError('RATE_LIMITED', 'Too many attempts. Try again later.');
	}
	const invalid = () => new PasswordTokenError('INVALID_TOKEN', 'This link is invalid or has expired. Ask for a new one.');
	const row = await findRow(k, input.token);
	if (!row) throw invalid();
	const t = table(k, AUTH_TABLES.verification);
	const deleted = (await authDb(k).delete(t).where(eq(t.id, row.id)).returning({ id: t.id })) as unknown[];
	// Two requests with the same link: only the one that deleted the row goes on.
	if (deleted.length !== 1) throw invalid();
	const user = await userById(k, row.userId);
	if (!user || typeof user.email !== 'string') throw invalid();

	const hash = await ctx.password.hash(pw);
	const accounts = await ctx.internalAdapter.findAccounts(row.userId);
	if (accounts.some((a) => a.providerId === 'credential')) await ctx.internalAdapter.updatePassword(row.userId, hash);
	else {
		await ctx.internalAdapter.linkAccount({ userId: row.userId, providerId: 'credential', accountId: row.userId, password: hash });
	}
	await deleteTokensOf(k, row.userId);
	for (const session of await ctx.internalAdapter.listSessions(row.userId)) {
		await ctx.internalAdapter.deleteSession(session.token);
	}
	return { email: user.email };
}

/** Builds the link for a token (an absolute URL to `/admin/reset-password?token=...`). */
export type PasswordLink = (token: string) => string;

async function sendLink(
	k: KitcmsInternals,
	user: { email: string; name?: unknown },
	kind: PasswordTokenKind,
	link: string,
	title: string,
): Promise<void> {
	const hello = typeof user.name === 'string' && user.name.trim() ? `Hello ${user.name.trim()},` : 'Hello,';
	const lines =
		kind === 'invite'
			? [
					hello,
					'',
					`You have been invited to edit the website ${title}. Choose a password to sign in:`,
					'',
					link,
					'',
					'The link works for 7 days.',
				]
			: [
					hello,
					'',
					`Someone asked to reset the password of your account for ${title}. To choose a new password, open:`,
					'',
					link,
					'',
					'The link works for one hour. If you did not ask for this, ignore this email: your password stays the same.',
				];
	await k.email.send({
		to: user.email,
		subject: kind === 'invite' ? `Set your password for ${title}` : `Reset your password for ${title}`,
		text: lines.join('\n'),
	});
}

/**
 * Emails an invite (a set-password link valid for 7 days) to an existing user. Throws
 * `EmailNotConfiguredError` when email is off. Earlier links of the user stop working.
 */
export async function sendInvite(
	k: KitcmsInternals,
	userId: string,
	opts: { link: PasswordLink; title: string },
): Promise<void> {
	const user = await userById(k, userId);
	if (!user || typeof user.email !== 'string') throw new ValidationError([{ path: 'id', message: 'Unknown user.' }]);
	const token = await issuePasswordToken(k, userId, 'invite');
	await sendLink(k, { email: user.email, name: user.name }, 'invite', opts.link(token), opts.title);
}

export type ResetRequestResult = 'done' | 'rate-limited' | 'email-off';

/**
 * "Forgot password". `done` whether or not the account exists (the caller shows one message for
 * both); only users with admin access get a link. `email-off` when email isn't configured at all
 * (a fact about the site, not the account).
 */
export async function requestPasswordReset(
	k: KitcmsInternals,
	input: { email: string; ip: string | null; link: PasswordLink; title: string },
): Promise<ResetRequestResult> {
	if (!k.email.enabled) return 'email-off';
	const email = normalizeEmail(String(input.email ?? ''));
	if (!email || email.length > 254) return 'done';
	const db = authDb(k);
	const rl = table(k, AUTH_TABLES.rateLimit);
	let allowed = (await consume(db, rl, `kitcms:pwreset:email:${email}`, RESET_REQUEST_RULE)).allowed;
	if (input.ip) allowed = (await consume(db, rl, `kitcms:pwreset:ip:${input.ip}`, RESET_REQUEST_RULE)).allowed && allowed;
	if (!allowed) return 'rate-limited';

	const { docs } = (await k.cmsFor(null).find(k.config.authCollection, {
		where: { email: { equals: email } },
		limit: 1,
		overrideAccess: true,
	})) as { docs: Record<string, unknown>[] };
	const found = docs[0];
	if (!found || typeof found.id !== 'string' || typeof found.email !== 'string') return 'done';
	const user = toKitcmsUser(found, k.config.authCollection);
	const canUseAdmin = await adminAccess(k.config, { user, context: {}, cms: k.cms, source: 'admin' });
	if (!canUseAdmin) return 'done';
	const token = await issuePasswordToken(k, found.id, 'reset');
	try {
		await sendLink(k, { email: found.email, name: found.name }, 'reset', input.link(token), input.title);
	} catch (err) {
		// Don't reveal the account through an error; log for the operator.
		console.error('kitcms: password reset email failed', err instanceof Error ? err.message : err);
	}
	return 'done';
}
