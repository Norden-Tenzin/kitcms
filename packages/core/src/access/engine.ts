// Access-control engine (plan §4.6). SECURITY-CRITICAL: changes need Opus review and tests.
//
// Rules:
// - Fail closed. A rule that returns anything other than `true`, `false` or a plain `where`
//   object denies. A rule that throws fails the operation. `create` and `admin` rules must
//   return booleans (a `where` there denies).
// - Defaults when a rule is omitted (Decision 22): signed-in users only. The auth collection has
//   stricter defaults: create/delete admin-only, update admin or self, and its `role` and
//   `emailVerified` fields are writable by admins only.
// - A `where` from a rule is ANDed with the caller's `where` as a separate group (`mergeWhere`),
//   so nothing the caller passes can widen it.
// - `overrideAccess` skips collection AND field rules. It is never derived from client input.
// - Upload built-in fields (filename, key, ...) are writable only through the upload endpoint,
//   which marks its `req` with `markUploadWrite` (an unforgeable WeakSet entry, not a context key).

import type { KitcmsReq, KitcmsUser, Operation } from '../config/hooks';
import type { SanitizedCollection, SanitizedConfig, SanitizedField } from '../config/sanitized';
import type { WhereInput } from '../config/where';
import { ForbiddenError } from '../errors';

/** `true` (allow all), `false` (deny), or a filter the documents must match. */
export type AccessDecision = boolean | WhereInput;

export const ADMIN_ROLE = 'admin';

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const proto: unknown = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/** Normalizes a rule's return value. Anything unexpected denies. */
export function normalizeDecision(result: unknown, allowWhere: boolean): AccessDecision {
	if (result === true) return true;
	if (allowWhere && isPlainObject(result)) return result as WhereInput;
	return false;
}

export function isAdmin(user: KitcmsUser | null): boolean {
	return user !== null && user.role === ADMIN_ROLE;
}

function signedIn({ req }: { req: KitcmsReq }): boolean {
	return req.user !== null;
}

/** The defaults applied when a collection omits a rule. */
function defaultRule(
	collection: SanitizedCollection,
	operation: Operation,
	req: KitcmsReq,
): AccessDecision {
	if (!collection.auth) return signedIn({ req });
	const user = req.user;
	switch (operation) {
		case 'read':
			return user !== null;
		case 'create':
		case 'delete':
			return isAdmin(user);
		case 'update':
			if (isAdmin(user)) return true;
			return user !== null ? { id: { equals: user.id } } : false;
	}
}

export interface AccessArgsInput {
	req: KitcmsReq;
	id?: string;
	data?: Record<string, unknown>;
	overrideAccess?: boolean;
}

/** Evaluates a collection-level rule. */
export async function collectionAccess(
	collection: SanitizedCollection,
	operation: Operation,
	args: AccessArgsInput,
): Promise<AccessDecision> {
	if (args.overrideAccess) return true;
	const rule = collection.access[operation] as
		| ((a: { req: KitcmsReq; id?: string; data?: Record<string, unknown> }) => unknown)
		| undefined;
	if (!rule) return defaultRule(collection, operation, args.req);
	const result = await rule({ req: args.req, id: args.id, data: args.data });
	return normalizeDecision(result, operation !== 'create');
}

/** ANDs an access `where` onto the caller's filter. `false` must be handled by the caller first. */
export function mergeWhere(
	callerWhere: WhereInput | undefined,
	decision: Exclude<AccessDecision, false>,
): WhereInput | undefined {
	if (decision === true) return callerWhere;
	if (!callerWhere || Object.keys(callerWhere).length === 0) return { and: [decision] };
	return { and: [callerWhere, decision] };
}

/**
 * May this user use the admin panel? The auth collection's `access.admin`, or by default: the
 * user's role is one of the `role` field's options.
 */
export async function adminAccess(config: SanitizedConfig, req: KitcmsReq): Promise<boolean> {
	const user = req.user;
	if (user === null) return false;
	const auth = config.collectionsBySlug[config.authCollection];
	if (!auth) return false;
	if (auth.access.admin) {
		return normalizeDecision(await auth.access.admin({ req }), false) === true;
	}
	const role = auth.fields.find((f) => f.name === 'role');
	if (role?.type !== 'select') return false;
	return role.options.some((o) => o.value === user.role);
}

// ---------------------------------------------------------------------------------------------
// Field-level access
// ---------------------------------------------------------------------------------------------

const uploadWrites = new WeakSet<KitcmsReq>();

/** Marks a request as the upload endpoint's own write (allows writing upload built-in fields). */
export function markUploadWrite(req: KitcmsReq): void {
	uploadWrites.add(req);
}

export const UPLOAD_FIELDS = ['filename', 'mimeType', 'filesize', 'width', 'height', 'key'] as const;
const ADMIN_ONLY_AUTH_FIELDS = ['role', 'emailVerified'] as const;

type FieldRule = (args: {
	req: KitcmsReq;
	id?: string;
	data?: Record<string, unknown>;
	siblingData?: Record<string, unknown>;
}) => unknown;

/** The write rule for a top-level built-in field, or undefined. */
function builtInWriteRule(
	collection: SanitizedCollection,
	field: SanitizedField,
	operation: 'create' | 'update',
): FieldRule | undefined {
	if (collection.upload && (UPLOAD_FIELDS as readonly string[]).includes(field.name)) {
		return ({ req }) => uploadWrites.has(req);
	}
	if (
		collection.auth &&
		(ADMIN_ONLY_AUTH_FIELDS as readonly string[]).includes(field.name) &&
		!field.access?.[operation]
	) {
		return ({ req }) => isAdmin(req.user);
	}
	return undefined;
}

async function allowed(rule: FieldRule | undefined, args: Parameters<FieldRule>[0]) {
	if (!rule) return true;
	return (await rule(args)) === true;
}

/**
 * Removes fields the user may not read, recursively (mutates `doc`). Denied containers are
 * removed whole.
 */
export async function filterReadableFields(
	fields: readonly SanitizedField[],
	doc: Record<string, unknown>,
	req: KitcmsReq,
	id: string | undefined,
	root: Record<string, unknown> = doc,
): Promise<void> {
	for (const field of fields) {
		if (!(field.name in doc)) continue;
		const rule = field.access?.read as FieldRule | undefined;
		if (!(await allowed(rule, { req, id, data: root, siblingData: doc }))) {
			delete doc[field.name];
			continue;
		}
		await forEachChildContainer(field, doc[field.name], (childFields, child) =>
			filterReadableFields(childFields, child, req, id, root),
		);
	}
}

/**
 * Applies field create/update access to incoming data (mutates `data`). A denied value is
 * dropped on create (so the default applies) and reset to the stored value on update (rows are
 * matched to stored rows by `id`; a denied field in a new row is dropped).
 * `original` is the stored counterpart of `data` at this level (undefined on create / new rows).
 */
export async function applyWriteFieldAccess(
	collection: SanitizedCollection,
	fields: readonly SanitizedField[],
	data: Record<string, unknown>,
	operation: 'create' | 'update',
	ctx: { req: KitcmsReq; id?: string; root: Record<string, unknown>; topLevel: boolean },
	original: Record<string, unknown> | undefined,
): Promise<void> {
	for (const field of fields) {
		if (!(field.name in data)) continue;
		const custom = field.access?.[operation] as FieldRule | undefined;
		const builtIn = ctx.topLevel ? builtInWriteRule(collection, field, operation) : undefined;
		const args = { req: ctx.req, id: ctx.id, data: ctx.root, siblingData: data };
		const ok = (await allowed(builtIn, args)) && (await allowed(custom, args));
		if (!ok) {
			if (original && field.name in original) data[field.name] = structuredClone(original[field.name]);
			else delete data[field.name];
			continue;
		}
		const value = data[field.name];
		const stored = original?.[field.name];
		const childCtx = { ...ctx, topLevel: false };
		if (field.type === 'group' && isPlainObject(value)) {
			await applyWriteFieldAccess(collection, field.fields, value, operation, childCtx,
				isPlainObject(stored) ? stored : undefined);
		} else if ((field.type === 'array' || field.type === 'blocks') && Array.isArray(value)) {
			const storedRows = new Map<string, Record<string, unknown>>();
			if (Array.isArray(stored)) {
				for (const r of stored) if (isPlainObject(r) && typeof r.id === 'string') storedRows.set(r.id, r);
			}
			for (const row of value) {
				if (!isPlainObject(row)) continue;
				const childFields =
					field.type === 'array' ? field.fields : field.blocks.find((b) => b.slug === row.blockType)?.fields;
				if (!childFields) continue;
				const match = typeof row.id === 'string' ? storedRows.get(row.id) : undefined;
				// A stored row only counts as the same row if it is the same block type.
				const prev = match && (field.type === 'array' || match.blockType === row.blockType) ? match : undefined;
				await applyWriteFieldAccess(collection, childFields, row, operation, childCtx, prev);
			}
		}
	}
}

async function forEachChildContainer(
	field: SanitizedField,
	value: unknown,
	fn: (fields: readonly SanitizedField[], child: Record<string, unknown>) => Promise<void>,
): Promise<void> {
	if (field.type === 'group' && isPlainObject(value)) {
		await fn(field.fields, value);
	} else if (field.type === 'array' && Array.isArray(value)) {
		for (const row of value) if (isPlainObject(row)) await fn(field.fields, row);
	} else if (field.type === 'blocks' && Array.isArray(value)) {
		for (const row of value) {
			if (!isPlainObject(row)) continue;
			const block = field.blocks.find((b) => b.slug === row.blockType);
			if (block) await fn(block.fields, row);
		}
	}
}

// ---------------------------------------------------------------------------------------------
// Query access: no filtering or sorting on fields the caller can't read
// ---------------------------------------------------------------------------------------------

/** Top-level field names a caller's `where` references (recursing through and/or). */
export function whereFields(where: WhereInput | undefined, out = new Set<string>(), depth = 0): Set<string> {
	if (!where || typeof where !== 'object' || depth > 16) return out;
	for (const [key, value] of Object.entries(where)) {
		if ((key === 'and' || key === 'or') && Array.isArray(value)) {
			for (const w of value) whereFields(w as WhereInput, out, depth + 1);
		} else {
			out.add(key);
		}
	}
	return out;
}

/**
 * Throws `ForbiddenError` when the caller filters or sorts on a field whose read access denies
 * them: otherwise `where` would be an oracle for values they can't read (filter on `secret`, see
 * which documents come back). Field rules are evaluated without a document. Only the CALLER's
 * `where` is checked; `where` filters from access rules are trusted code.
 */
export async function assertQueryable(
	collection: SanitizedCollection,
	where: WhereInput | undefined,
	sort: string[],
	req: KitcmsReq,
	overrideAccess: boolean | undefined,
): Promise<void> {
	if (overrideAccess) return;
	const names = whereFields(where);
	for (const s of sort) names.add(s.startsWith('-') ? s.slice(1) : s);
	for (const name of names) {
		const field = collection.fields.find((f) => f.name === name);
		const rule = field?.access?.read as FieldRule | undefined;
		if (rule && !(await allowed(rule, { req }))) {
			throw new ForbiddenError(`You may not query the field "${name}".`);
		}
	}
}
