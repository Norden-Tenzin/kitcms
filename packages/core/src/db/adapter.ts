// The internal database boundary (principle 4). D1 is the only implementation (./d1.ts), but the
// pipeline only ever talks to this interface.
//
// Design for the latency budget (§11: each sequential D1 round trip costs ~150 ms deployed):
// methods don't execute. They return statements, and `batch()` sends any number of them in ONE
// round trip (D1 `batch()`, which also runs them as one transaction). The pipeline groups
// independent reads/writes into one batch: find + count, update + refs, all populate lookups.
//
// Values crossing this boundary are DOCUMENT values, never raw column values:
// dates are ISO strings (Decision 21), JSON columns are parsed, checkboxes are booleans, hasMany
// fields are id arrays. The adapter converts both ways and strips keys that aren't columns.

import type { WhereInput } from '../config/where';

/** A document as stored: system fields + top-level field values. */
export type Row = Record<string, unknown> & { id: string; createdAt: string; updatedAt: string };

/** One reference from a document to another (see ../refs). */
export interface Ref {
	/**
	 * Dot path of the FIELD holding the reference, from the document root, with array/blocks row
	 * indexes: `cover`, `sections.2.image`. Every id of a hasMany field shares its field's path
	 * (`tags`, not `tags.0`), so `where` on top-level hasMany fields matches `path = 'tags'`.
	 */
	path: string;
	toCollection: string;
	toId: string;
}

/** A reference pointing at a document, as stored in `_refs`. */
export interface IncomingRef {
	fromCollection: string;
	fromId: string;
	path: string;
}

/** An unexecuted statement. Only `batch()`/`run()` execute it. Opaque outside the adapter. */
export interface Stmt<T> {
	readonly '~result'?: T;
}

export interface SelectArgs {
	collection: string;
	/** Compiled by the adapter per the semantics in ../config/where.ts. Throws `QueryError`. */
	where?: WhereInput;
	/**
	 * Sort keys: `'title'` or `'-title'`. Must be system or top-level column fields (`QueryError`
	 * otherwise). The adapter always appends `id` (same direction as the last key) as a tie-break,
	 * so pagination is stable.
	 */
	sort?: string[];
	limit?: number;
	offset?: number;
}

/** A stored version (§13.4). `version` is the document data without system fields. */
export interface VersionRow {
	id: string;
	parent: string;
	version: Record<string, unknown>;
	/** Collections/globals with drafts only. */
	_status?: 'draft' | 'published';
	autosave: boolean;
	latest: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface DbAdapter {
	/** The D1 session bookmark after the queries run so far (`null` without a session or before any query). */
	bookmark?(): string | null;
	select(args: SelectArgs): Stmt<Row[]>;
	/** `id IN (...)`, plus an optional extra filter (the target's read access). Order not guaranteed. */
	selectByIds(collection: string, ids: string[], where?: WhereInput): Stmt<Row[]>;
	count(args: { collection: string; where?: WhereInput }): Stmt<number>;

	/**
	 * Inserts a full document (`id`, `createdAt`, `updatedAt` set by the caller) and returns it as
	 * stored. A UNIQUE violation fails the whole batch with a `ValidationError` on that field.
	 */
	insert(collection: string, doc: Row): Stmt<Row>;
	/**
	 * Updates one document by id, only if it also matches `where` (the caller's update access).
	 * `values` may be partial. Returns the stored document, or `null` when nothing matched.
	 */
	update(
		collection: string,
		id: string,
		values: Partial<Row>,
		where?: WhereInput,
	): Stmt<Row | null>;
	/** Deletes one document by id, only if it also matches `where`. Returns it, or `null`. */
	delete(collection: string, id: string, where?: WhereInput): Stmt<Row | null>;

	/**
	 * Replaces every `_refs` row from (fromCollection, fromId) with `refs`.
	 * With `guard`, the new rows are only inserted if the document row still has
	 * `updatedAt === guard.updatedAt` (i.e. the write in the same batch took effect), so a
	 * concurrent or no-op write can't leave refs pointing at the wrong state.
	 */
	setRefs(
		fromCollection: string,
		fromId: string,
		refs: Ref[],
		guard?: { updatedAt: string },
	): Stmt<void>;
	/** Deletes every `_refs` row from this document (used on delete). */
	deleteRefsFrom(fromCollection: string, fromId: string): Stmt<void>;
	/** Documents referencing (toCollection, toId), excluding self-references, with the total count. */
	refsTo(
		toCollection: string,
		toId: string,
		limit: number,
	): Stmt<{ refs: IncomingRef[]; total: number }>;

	/** Orderable collections (§13.2): the largest `_order` key, or `null` when there is none. */
	maxOrder(collection: string): Stmt<string | null>;
	/**
	 * Orderable collections: the order key of `target` and of its neighbour on `side`, ignoring
	 * `excludeId` (the document being moved). `after` → the smallest key greater than the target's,
	 * `before` → the largest key smaller than the target's. `null` result = the target doesn't
	 * exist; a `null` `key` = it has no order key yet; a `null` `neighbour` = nothing on that side.
	 */
	orderNeighbour(
		collection: string,
		targetId: string,
		side: 'before' | 'after',
		excludeId: string,
	): Stmt<{ key: string | null; neighbour: string | null } | null>;

	/** Versions (§13.4). `collection` is the main table slug; its `_versions` table is used. */
	insertVersion(collection: string, version: VersionRow): Stmt<void>;
	/** Sets `latest = 0` on every version of `parent` (run before inserting the new latest one). */
	clearLatest(collection: string, parent: string): Stmt<void>;
	/** Deletes all but the newest `keep` versions of `parent` (by createdAt, then id). */
	pruneVersions(collection: string, parent: string, keep: number): Stmt<void>;
	/** Rewrites a version in place (autosave). */
	updateVersion(
		collection: string,
		versionId: string,
		values: { version: Record<string, unknown>; updatedAt: string },
	): Stmt<void>;
	/** The `latest` version of each parent (parents without versions are absent). */
	latestVersions(collection: string, parents: string[]): Stmt<VersionRow[]>;
	/** Versions of one parent, newest first, with the total. */
	listVersions(
		collection: string,
		parent: string,
		limit: number,
		offset: number,
	): Stmt<{ docs: VersionRow[]; total: number }>;
	versionById(collection: string, versionId: string): Stmt<VersionRow | null>;

	/** Executes the statements in one round trip (one D1 batch, atomic). Results in order. */
	batch<const T extends readonly Stmt<unknown>[]>(
		stmts: T,
	): Promise<{ -readonly [K in keyof T]: T[K] extends Stmt<infer R> ? R : never }>;
	/** `batch([stmt])` for one statement. */
	run<T>(stmt: Stmt<T>): Promise<T>;
}
