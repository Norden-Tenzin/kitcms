// Access-control and hook signatures (Payload semantics, plan §4.6).

import type { RequestEvent } from '@sveltejs/kit';
import type { Cms } from '../api/types';
import type { WhereInput } from './where';

/**
 * The signed-in user as seen by access rules and hooks. Never carries credentials.
 * `role` is the stored value of the auth collection's `role` field.
 */
export interface KitcmsUser {
	id: string;
	email: string;
	name: string;
	role: string;
	/** The collection the user belongs to (the `auth: true` collection). */
	collection: string;
	/** Multi-tenancy only (§15.2): the ids in the auth collection's tenants field. */
	tenants?: readonly string[];
}

export type Operation = 'create' | 'read' | 'update' | 'delete';
export type WriteOperation = 'create' | 'update';

/** Where an operation came from. Access rules may use it, e.g. to allow writes only from the admin. */
export type Source = 'local' | 'admin' | 'rpc' | 'rest';

/**
 * Per-operation request state, passed to every access rule and hook of one operation.
 * Nested Local API calls made with `{ req }` share it (and its `context`).
 */
export interface KitcmsReq {
	/** `null` = anonymous. On public site routes the session is never resolved, so this is `null`. */
	user: KitcmsUser | null;
	/** Free-form state shared by all hooks of one operation and of nested calls that pass `{ req }`. */
	context: Record<string, unknown>;
	/** The Local API, acting as the same user. Pass `{ req }` to nested calls to share `context`. */
	cms: Cms;
	source: Source;
	/** The SvelteKit request, when there is one (absent for RPC and plain Local API calls). */
	event?: RequestEvent;
	/**
	 * Multi-tenancy (§15.2): the tenant this operation acts on, `null` = none (or every tenant, for
	 * trusted code and `'all'` users). Set by the request (host, admin selection, RPC `{ tenant }`),
	 * never by operation options. Read it; don't change it.
	 */
	readonly tenant: string | null;
}

type MaybePromise<T> = T | Promise<T>;

// ---------------------------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------------------------

/**
 * `true` allows, `false` denies, and a `where` allows only matching documents. A `where` is
 * ANDed into the query (read, update, delete), and checked against the stored document for
 * single-document writes. `create` rules must return a boolean.
 */
export type AccessResult = boolean | WhereInput;

export interface AccessArgs<Doc = Record<string, unknown>> {
	req: KitcmsReq;
	/** The document id, for operations on one document. */
	id?: string;
	/** The incoming data, for create and update. */
	data?: Partial<Doc>;
}

export type Access<Doc = Record<string, unknown>> = (
	args: AccessArgs<Doc>,
) => MaybePromise<AccessResult>;

export interface CollectionAccess<Doc = Record<string, unknown>> {
	/** Default: signed-in users only. Return `true` for public content. */
	read?: Access<Doc>;
	/** Default: signed-in users only. Must return a boolean. */
	create?: (args: AccessArgs<Doc>) => MaybePromise<boolean>;
	/** Default: signed-in users only. */
	update?: Access<Doc>;
	/** Default: signed-in users only. */
	delete?: Access<Doc>;
	/**
	 * Auth collection only: may this user use the admin panel at all?
	 * Default: the user's `role` is one of the `role` field's options.
	 */
	admin?: (args: { req: KitcmsReq }) => MaybePromise<boolean>;
}

export interface FieldAccessArgs {
	req: KitcmsReq;
	id?: string;
	/** The whole document (read) or the incoming data (create/update). */
	data?: Record<string, unknown>;
	/** The object that holds this field (the document, a group, a row or a block). */
	siblingData?: Record<string, unknown>;
}

/** Field access returns booleans only. Default: allowed. */
export interface FieldAccess {
	/** Denied → the field is removed from the returned document. */
	read?: (args: FieldAccessArgs) => MaybePromise<boolean>;
	/** Denied → the input value is dropped (the default applies). */
	create?: (args: FieldAccessArgs) => MaybePromise<boolean>;
	/** Denied → the input value is dropped and the stored value is kept. */
	update?: (args: FieldAccessArgs) => MaybePromise<boolean>;
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

export interface ValidateArgs {
	req: KitcmsReq;
	operation: WriteOperation;
	id?: string;
	/** The whole incoming document (after defaults and `beforeValidate`). */
	data: Record<string, unknown>;
	siblingData: Record<string, unknown>;
}

/** Return `true` or nothing when valid, or an error message. Runs on the server. */
export type FieldValidate<T> = (
	value: T | null | undefined,
	args: ValidateArgs,
) => MaybePromise<true | string | undefined | void>;

// ---------------------------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------------------------

export interface FieldHookArgs<T> {
	req: KitcmsReq;
	operation: Operation;
	value: T | null | undefined;
	/** The stored document (update, read, delete). */
	originalDoc?: Record<string, unknown>;
	data: Record<string, unknown>;
	siblingData: Record<string, unknown>;
}

/** Return a new value, or nothing to keep it. */
export type FieldHook<T> = (args: FieldHookArgs<T>) => MaybePromise<T | null | undefined | void>;

export interface FieldHooks<T> {
	beforeValidate?: FieldHook<T> | FieldHook<T>[];
	beforeChange?: FieldHook<T> | FieldHook<T>[];
	afterChange?: FieldHook<T> | FieldHook<T>[];
	afterRead?: FieldHook<T> | FieldHook<T>[];
}

export interface BeforeChangeArgs<Doc> {
	req: KitcmsReq;
	operation: WriteOperation;
	/** The incoming data. Return a new object (or mutate and return nothing). */
	data: Partial<Doc>;
	/** The stored document, on update. */
	originalDoc?: Doc;
}
export interface AfterChangeArgs<Doc> {
	req: KitcmsReq;
	operation: WriteOperation;
	doc: Doc;
	previousDoc?: Doc;
}
export interface ReadHookArgs<Doc> {
	req: KitcmsReq;
	doc: Doc;
}
export interface DeleteHookArgs<Doc> {
	req: KitcmsReq;
	id: string;
	doc: Doc;
}

type OneOrMany<H> = H | H[];

/**
 * Collection hooks, in pipeline order:
 * create/update: beforeValidate → (validate) → beforeChange → D1 → afterChange → afterRead
 * read:          (D1) → beforeRead → afterRead
 * delete:        beforeDelete → D1 → afterDelete
 * A hook may return a replacement object, or nothing to keep its input.
 */
export interface CollectionHooks<Doc = Record<string, unknown>> {
	beforeValidate?: OneOrMany<(args: BeforeChangeArgs<Doc>) => MaybePromise<Partial<Doc> | void>>;
	beforeChange?: OneOrMany<(args: BeforeChangeArgs<Doc>) => MaybePromise<Partial<Doc> | void>>;
	afterChange?: OneOrMany<(args: AfterChangeArgs<Doc>) => MaybePromise<Doc | void>>;
	beforeRead?: OneOrMany<(args: ReadHookArgs<Doc>) => MaybePromise<Doc | void>>;
	afterRead?: OneOrMany<(args: ReadHookArgs<Doc>) => MaybePromise<Doc | void>>;
	beforeDelete?: OneOrMany<(args: DeleteHookArgs<Doc>) => MaybePromise<void>>;
	afterDelete?: OneOrMany<(args: DeleteHookArgs<Doc>) => MaybePromise<void>>;
}
