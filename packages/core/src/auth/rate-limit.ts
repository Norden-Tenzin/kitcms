// Sign-in rate limiting on the `auth_rate_limits` table (per-isolate memory is useless on Workers).
//
// Better Auth rate-limits only requests that go through its HTTP router (`onRequestRateLimit` in its
// request pipeline); server-side `auth.api.signInEmail()` calls skip it. The admin login action uses
// the latter, so it must call `checkSignInRateLimit` itself. Same table, keys namespaced `kitcms:`
// so they never collide with Better Auth's own path-based keys.
//
// Fixed window, one atomic UPSERT per key (no read-modify-write race): `lastRequest` holds the window
// START; a request after the window rolls the row over to count 1.
//
// FAIL CLOSED: if the limiter can't reach D1 the sign-in is refused (the error propagates). Failing
// open would let an attacker who can degrade D1 brute-force passwords; failing closed makes a D1
// outage a login outage, which a D1 outage already is (sessions and users live there too).
import { sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { AnyTable } from '../schema/drizzle';
import { ulid } from '../ulid';

export interface RateRule {
	/** Max attempts per window. */
	max: number;
	/** Window length, seconds. */
	window: number;
}

export const SIGN_IN_RULE: RateRule = { max: 5, window: 60 };

export interface RateDecision {
	allowed: boolean;
	/** Seconds until the window rolls over (only when blocked). */
	retryAfter: number;
	count: number;
}

/** Pure: the decision for a row after this attempt was counted. Mirrors the SQL in `consume`. */
export function decide(row: { count: number; lastRequest: number }, rule: RateRule, now: number): RateDecision {
	const retryAfter = Math.max(1, Math.ceil((row.lastRequest + rule.window * 1000 - now) / 1000));
	const allowed = row.count <= rule.max;
	return { allowed, retryAfter: allowed ? 0 : retryAfter, count: row.count };
}

/** Normalizes the email part of a key so `A@b.co ` and `a@b.co` share a bucket. */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function signInKeys(input: { ip: string | null; email: string }): string[] {
	const keys = [`kitcms:signin:email:${normalizeEmail(input.email)}`];
	// No IP (local dev without Cloudflare's header): the per-email bucket still applies.
	if (input.ip) keys.push(`kitcms:signin:ip:${input.ip}`);
	return keys;
}

export type AuthDb = DrizzleD1Database<Record<string, never>>;

/** Counts one attempt on `key` and returns the decision. Throws on DB errors (callers fail closed). */
export async function consume(
	db: AuthDb,
	table: AnyTable,
	key: string,
	rule: RateRule,
	now = Date.now(),
): Promise<RateDecision> {
	const cutoff = now - rule.window * 1000;
	const [row] = await db
		.insert(table)
		.values({ id: ulid(now), key, count: 1, lastRequest: now })
		.onConflictDoUpdate({
			target: table.key,
			// All right-hand sides see the OLD row, so both CASEs agree on whether the window expired.
			set: {
				count: sql`CASE WHEN ${table.lastRequest} <= ${cutoff} THEN 1 ELSE ${table.count} + 1 END`,
				lastRequest: sql`CASE WHEN ${table.lastRequest} <= ${cutoff} THEN ${now} ELSE ${table.lastRequest} END`,
			},
		})
		.returning({ count: table.count, lastRequest: table.lastRequest });
	if (!row) throw new Error('kitcms: rate limiter returned no row.');
	return decide({ count: Number(row.count), lastRequest: Number(row.lastRequest) }, rule, now);
}

export interface SignInRateResult {
	allowed: boolean;
	retryAfter: number;
}

/** Counts a sign-in attempt against the per-IP and per-email buckets. Blocked if either is over. */
export async function checkSignInRateLimit(
	db: AuthDb,
	table: AnyTable,
	input: { ip: string | null; email: string },
	rule: RateRule = SIGN_IN_RULE,
	now = Date.now(),
): Promise<SignInRateResult> {
	let retryAfter = 0;
	let allowed = true;
	// Count every bucket even when an earlier one blocked (so the attempt is always recorded).
	for (const key of signInKeys(input)) {
		const d = await consume(db, table, key, rule, now);
		if (!d.allowed) {
			allowed = false;
			retryAfter = Math.max(retryAfter, d.retryAfter);
		}
	}
	return { allowed, retryAfter };
}
