// The operation pipeline and the Local API (plan §4.3, §4.6).
// Every entry point (Local API, RPC, REST, admin actions) calls these operations:
//
//   create:  access(create) → strip unknown → field write access → defaults → slugs
//            → beforeValidate → validate → beforeChange → D1 (insert + refs, 1 batch)
//            → afterChange → read pipeline
//   update:  access(update) → load stored doc (1 round trip) → field write access → merge
//            → defaults → slugs → beforeValidate → validate → beforeChange
//            → D1 (update + refs, 1 batch) → afterChange → read pipeline
//   findGlobal:   access(read) → D1 (1 row, id = slug; missing → static defaults) → read pipeline
//   updateGlobal: access(update) → load row (1 round trip) → same as create (first save, inserts
//                 id = slug) or update → D1 (write + refs, 1 batch) → afterChange → read pipeline
//   delete:  access(delete) → load + incoming refs (1 batch) → beforeDelete
//            → D1 (delete + refs, 1 batch) → afterDelete
//   read:    access(read) → D1 (rows + count, 1 batch) → read pipeline → populate
//            (1 batch per depth level, across all target collections)
//   read pipeline, per doc: beforeRead → field read access → field afterRead → file url
//            → afterRead
//
// Drafts and versions (§13.4): the main table is the PUBLISHED state. Reads without `draft: true`
// are ANDed with `_status = 'published'` (find, count, populate, globals). Draft reads overlay the
// latest version when it is newer than the main row. Writes go through `persist`: a draft save
// adds a version and leaves the main row alone (unless that row is itself only a draft); a save
// without `draft` publishes. `move` and `unpublish` are meta writes (no version, no `updatedAt`).
//
// Round-trip budget (§11): a depth-1 populated read is 2 sequential D1 round trips; writes are 2
// (create: 1). Draft reads: findByID/findGlobal 1, find 2.

import type { RequestEvent } from '@sveltejs/kit';
import {
	adminAccess,
	applyWriteFieldAccess,
	assertQueryable,
	collectionAccess,
	filterReadableFields,
	mergeWhere,
	type AccessDecision,
} from '../access/engine';
import type { KitcmsReq, KitcmsUser, Source, WriteOperation } from '../config/hooks';
import {
	ORDER_FIELD,
	STATUS_FIELD,
	type SanitizedCollection,
	type SanitizedConfig,
	type SanitizedField,
} from '../config/sanitized';
import type { WhereInput } from '../config/where';
import type { DbAdapter, Ref, Row, Stmt, VersionRow } from '../db/adapter';
import {
	ForbiddenError,
	NotFoundError,
	QueryError,
	ReferencedError,
	ValidationError,
	type FieldError,
} from '../errors';
import { applyDefaults, fillSlugs, stripUnknown } from '../fields/defaults';
import { traverseFields } from '../fields/traverse';
import { validateDocument } from '../fields/validate';
import { runFieldHooks, runHooks } from '../hooks/run';
import { keyBetween } from '../order/key';
import { extractRefs } from '../refs/extract';

import { ulid } from '../ulid';
import { configFingerprint, withEdgeCacheLayer } from './cache';
import { collectRelationIds, replaceRelationIds } from './populate';
import type { Cms, MoveTarget, OperationOptions } from './types';

/** Optional file storage hooks used by the pipeline (implemented by the R2 upload module). */
export interface PipelineStorage {
	/** Public URL of an object key. */
	url(key: string): string;
	/** Best-effort removal after a document of an upload collection is deleted. */
	delete(key: string): Promise<void>;
}

export interface CmsContext {
	config: SanitizedConfig;
	db: DbAdapter;
	storage?: PipelineStorage;
	/** The user every operation acts as, unless an operation passes `req`. `null` = anonymous. */
	user: KitcmsUser | null;
	source: Source;
	event?: RequestEvent;
	/** Wait for background work (e.g. R2 cleanup) without delaying the response. */
	waitUntil?: (promise: Promise<unknown>) => void;
}

type Doc = Record<string, unknown>;
type Opts = OperationOptions & { depth?: number; draft?: boolean; autosave?: boolean };
/** Internal write kinds: meta writes that neither publish nor add versions. */
type WriteKind = 'move' | 'unpublish';

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 10;
const MAX_DEPTH = 2;
const MAX_VERSIONS_LIMIT = 100;
const SYSTEM_KEYS = new Set(['id', 'createdAt', 'updatedAt', ORDER_FIELD, STATUS_FIELD]);
const PUBLISHED: WhereInput = { [STATUS_FIELD]: { equals: 'published' } };

const hasDrafts = (col: SanitizedCollection): boolean => col.versions !== false && col.versions.drafts !== false;

/** `a AND b`, without wrapping an empty `a`. */
function andWhere(a: WhereInput | undefined, b: WhereInput): WhereInput {
	return a && Object.keys(a).length > 0 ? { and: [a, b] } : b;
}

/** Is this version newer than the main row, i.e. a draft on top of it? */
function isNewer(v: VersionRow, row: Row): boolean {
	return Date.parse(v.updatedAt) > Date.parse(row.updatedAt);
}

/** The document a draft read returns: the version's data on top of the main row's identity. */
function overlay(row: Row, v: VersionRow): Row {
	const out: Record<string, unknown> = {
		...v.version,
		id: row.id,
		createdAt: row.createdAt,
		updatedAt: v.updatedAt,
		[STATUS_FIELD]: 'draft',
	};
	if (ORDER_FIELD in row) out[ORDER_FIELD] = row[ORDER_FIELD];
	return out as Row;
}

function unionRefs(a: Ref[], b: Ref[]): Ref[] {
	const seen = new Set<string>();
	return [...a, ...b].filter((r) => {
		const key = JSON.stringify([r.path, r.toCollection, r.toId]);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function isPlainObject(value: unknown): value is Doc {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const proto: unknown = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function clampInt(value: unknown, fallback: number, min: number, max: number, name: string) {
	if (value === undefined) return fallback;
	if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
		throw new QueryError(`\`${name}\` must be an integer ≥ ${min}.`);
	}
	return Math.min(value, max);
}

function parseSort(sort: unknown, fallback: string): string[] {
	const raw = sort === undefined || sort === '' ? fallback : sort;
	if (typeof raw !== 'string') throw new QueryError('`sort` must be a string.');
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

function withoutSystem(doc: Doc): Doc {
	const out: Doc = {};
	for (const [k, v] of Object.entries(doc)) if (!SYSTEM_KEYS.has(k)) out[k] = v;
	return out;
}

/** Resolves the object that holds the value at `path` (the parent container). */
function parentAt(root: Doc, path: string): Doc {
	const parts = path.split('.');
	parts.pop();
	let cur: unknown = root;
	for (const p of parts) {
		if (Array.isArray(cur)) cur = cur[Number(p)];
		else if (isPlainObject(cur)) cur = cur[p];
		else return {};
	}
	return isPlainObject(cur) ? cur : {};
}

/** A field hidden by `admin.condition` is not validated (Decision 19). */
function hiddenByCondition(root: Doc, path: string, field: SanitizedField): boolean {
	const condition = field.admin.condition;
	if (!condition) return false;
	return !condition(root, parentAt(root, path));
}

/** The document of a global that was never saved: static defaults, shaped like a stored row. */
function staticDefaults(fields: readonly SanitizedField[]): Doc {
	const out: Doc = {};
	for (const field of fields) {
		if (field.defaultValue !== undefined && typeof field.defaultValue !== 'function') {
			out[field.name] = structuredClone(field.defaultValue);
		} else if (field.type === 'checkbox') out[field.name] = false;
		else if ((field.type === 'relationship' || field.type === 'upload') && field.hasMany) out[field.name] = [];
		else if (field.type === 'group') out[field.name] = staticDefaults(field.fields);
		else if (field.type === 'array' || field.type === 'blocks') out[field.name] = [];
	}
	return out;
}

export function createLocalApi(ctx: CmsContext): Cms {
	const { config, db } = ctx;

	function collectionOf(slug: unknown): SanitizedCollection {
		const col = typeof slug === 'string' ? config.collectionsBySlug[slug] : undefined;
		if (!col) throw new NotFoundError(`Unknown collection "${String(slug)}".`);
		return col;
	}

	function globalOf(slug: unknown): SanitizedCollection {
		const col = typeof slug === 'string' ? config.globalsBySlug[slug] : undefined;
		if (!col) throw new NotFoundError(`Unknown global "${String(slug)}".`);
		return col;
	}

	function makeReq(opts: OperationOptions | undefined): KitcmsReq {
		if (opts?.req) {
			if (opts.context) Object.assign(opts.req.context, opts.context);
			return opts.req;
		}
		return {
			user: ctx.user,
			context: { ...opts?.context },
			cms: api,
			source: ctx.source,
			event: ctx.event,
		};
	}

	async function access(
		col: SanitizedCollection,
		op: 'read' | 'update' | 'delete',
		req: KitcmsReq,
		opts: Opts | undefined,
		extra: { id?: string; data?: Doc } = {},
	): Promise<Exclude<AccessDecision, false>> {
		const decision = await collectionAccess(col, op, {
			req,
			overrideAccess: opts?.overrideAccess,
			...extra,
		});
		if (decision === false) throw new ForbiddenError();
		return decision;
	}

	// ----- validation ---------------------------------------------------------------------------

	async function validate(
		col: SanitizedCollection,
		data: Doc,
		req: KitcmsReq,
		operation: WriteOperation,
		id: string | undefined,
		draft = false,
	): Promise<void> {
		const skip = (path: string, field: SanitizedField) => hiddenByCondition(data, path, field);
		const errors: FieldError[] = validateDocument(col.fields, data, {
			skip: skip as (path: string, field: unknown) => boolean,
			draft,
		});
		const failed = new Set(errors.map((e) => e.path));
		await traverseFields(col.fields, data, async ({ field, path, siblingData }) => {
			if (hiddenByCondition(data, path, field)) return 'skip';
			if (!field.validate || failed.has(path)) return;
			const result = await field.validate(siblingData[field.name] as never, {
				req,
				operation,
				id,
				data,
				siblingData,
			});
			if (typeof result === 'string') errors.push({ path, message: result });
		});
		if (errors.length > 0) throw new ValidationError(errors);
	}

	// ----- read pipeline ------------------------------------------------------------------------

	async function readOne(
		col: SanitizedCollection,
		row: Row,
		req: KitcmsReq,
		override: boolean | undefined,
	): Promise<Doc> {
		let doc: Doc = await runHooks(col.hooks.beforeRead, { req, doc: row as never }, 'doc');
		doc = { ...doc };
		if (!override) await filterReadableFields(col.fields, doc, req, row.id);
		await runFieldHooks('afterRead', col.fields, doc, { req, operation: 'read', originalDoc: row });
		if (col.upload && typeof doc.key === 'string' && ctx.storage) {
			doc.url = ctx.storage.url(doc.key);
		}
		return runHooks(col.hooks.afterRead, { req, doc: doc as never }, 'doc');
	}

	/** Replaces relationship ids with documents, one batch per depth level. Mutates `items`. */
	async function populate(
		items: { col: SanitizedCollection; docs: Doc[] }[],
		depth: number,
		req: KitcmsReq,
		override: boolean | undefined,
		draft = false,
	): Promise<void> {
		if (depth <= 0) return;
		const ids = new Map<string, Set<string>>();
		for (const { col, docs } of items) collectRelationIds(col.fields, docs, ids);
		if (ids.size === 0) return;

		const targets: { col: SanitizedCollection; ids: string[]; where?: WhereInput }[] = [];
		for (const [slug, set] of ids) {
			const col = config.collectionsBySlug[slug];
			if (!col) continue;
			const decision = await collectionAccess(col, 'read', { req, overrideAccess: override });
			if (decision === false) continue; // unreadable targets stay ids
			// Drafts collections only resolve to published documents, unless the read is a draft read.
			let where = decision === true ? undefined : decision;
			if (hasDrafts(col) && !draft) where = andWhere(where, PUBLISHED);
			targets.push({ col, ids: [...set], where });
		}
		if (targets.length === 0) return;

		const results = await db.batch(targets.map((t) => db.selectByIds(t.col.slug, t.ids, t.where)));
		const fetched: { col: SanitizedCollection; docs: Doc[] }[] = [];
		for (const [i, t] of targets.entries()) {
			const rows = results[i] ?? [];
			fetched.push({
				col: t.col,
				docs: await Promise.all(rows.map((r) => readOne(t.col, r, req, override))),
			});
		}
		await populate(fetched, depth - 1, req, override, draft);

		const lookup = new Map<string, Doc>();
		for (const { col, docs } of fetched) {
			for (const d of docs) if (typeof d.id === 'string') lookup.set(`${col.slug}\u0000${d.id}`, d);
		}
		for (const item of items) {
			item.docs.forEach((doc, i) => {
				item.docs[i] = replaceRelationIds(item.col.fields, doc, (c, id) =>
					lookup.get(`${c}\u0000${id}`),
				);
			});
		}
	}

	async function readMany(
		col: SanitizedCollection,
		rows: Row[],
		req: KitcmsReq,
		opts: Opts | undefined,
		draft = false,
	): Promise<Doc[]> {
		const depth = clampInt(opts?.depth, 0, 0, MAX_DEPTH, 'depth');
		const docs = await Promise.all(rows.map((r) => readOne(col, r, req, opts?.overrideAccess)));
		const item = { col, docs };
		await populate([item], depth, req, opts?.overrideAccess, draft);
		return item.docs;
	}

	// ----- operations ---------------------------------------------------------------------------

	/** A draft read (§13.4). Anonymous callers can never read drafts, whatever the access rules say. */
	function draftRead(col: SanitizedCollection, opts: Opts | undefined, req: KitcmsReq): boolean {
		if (opts?.draft !== true || !hasDrafts(col)) return false;
		if (req.user === null && !opts.overrideAccess) throw new ForbiddenError();
		return true;
	}

	/** Replaces rows by their latest draft where that is newer (one extra round trip). */
	async function overlayLatest(col: SanitizedCollection, rows: Row[]): Promise<Row[]> {
		if (rows.length === 0) return rows;
		const latest = await db.run(
			db.latestVersions(
				col.slug,
				rows.map((r) => r.id),
			),
		);
		const byParent = new Map(latest.map((v) => [v.parent, v]));
		return rows.map((r) => {
			const v = byParent.get(r.id);
			return v && isNewer(v, r) ? overlay(r, v) : r;
		});
	}

	async function find(slug: string, args: Opts & Record<string, unknown> = {}) {
		const col = collectionOf(slug);
		const req = makeReq(args);
		const decision = await access(col, 'read', req, args);
		const draft = draftRead(col, args, req);
		const sort = parseSort(args.sort, col.defaultSort);
		await assertQueryable(col, args.where as WhereInput | undefined, sort, req, args.overrideAccess);
		let where = mergeWhere(args.where as WhereInput | undefined, decision);
		if (hasDrafts(col) && !draft) where = andWhere(where, PUBLISHED);
		const limit = clampInt(args.limit, DEFAULT_LIMIT, 1, MAX_LIMIT, 'limit');
		const page = clampInt(args.page, 1, 1, Number.MAX_SAFE_INTEGER, 'page');
		const select = db.select({ collection: slug, where, sort, limit, offset: (page - 1) * limit });

		let rows: Row[];
		let totalDocs: number;
		if (args.pagination === false) {
			rows = await db.run(select);
			totalDocs = rows.length;
		} else {
			[rows, totalDocs] = await db.batch([select, db.count({ collection: slug, where })]);
		}
		if (draft) rows = await overlayLatest(col, rows);
		const docs = await readMany(col, rows, req, args, draft);
		const totalPages = args.pagination === false ? 1 : Math.max(1, Math.ceil(totalDocs / limit));
		return {
			docs,
			totalDocs,
			limit,
			page,
			totalPages,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1,
		};
	}

	async function findOne(slug: string, args: Opts & Record<string, unknown> = {}) {
		const { docs } = await find(slug, { ...args, limit: 1, page: 1, pagination: false });
		return docs[0] ?? null;
	}

	async function findByID(slug: string, id: string, opts: Opts = {}) {
		const col = collectionOf(slug);
		if (typeof id !== 'string' || id === '') return null;
		const req = makeReq(opts);
		const decision = await access(col, 'read', req, opts, { id });
		const draft = draftRead(col, opts, req);
		let where = mergeWhere({ id: { equals: id } }, decision);
		if (hasDrafts(col) && !draft) where = andWhere(where, PUBLISHED);
		const select = db.select({ collection: slug, where, limit: 1 });
		let rows: Row[];
		if (draft) {
			const [found, latest] = await db.batch([select, db.latestVersions(slug, [id])]);
			rows = found;
			const v = latest[0];
			if (rows[0] && v && isNewer(v, rows[0])) rows = [overlay(rows[0], v)];
		} else {
			rows = await db.run(select);
		}
		if (rows.length === 0) return null;
		return (await readMany(col, rows, req, opts, draft))[0] ?? null;
	}

	async function count(slug: string, args: Opts & { where?: WhereInput } = {}) {
		const col = collectionOf(slug);
		const req = makeReq(args);
		const decision = await access(col, 'read', req, args);
		const draft = draftRead(col, args, req);
		await assertQueryable(col, args.where, [], req, args.overrideAccess);
		let where = mergeWhere(args.where, decision);
		if (hasDrafts(col) && !draft) where = andWhere(where, PUBLISHED);
		return db.run(db.count({ collection: slug, where }));
	}

	async function prepareWrite(
		col: SanitizedCollection,
		data: Doc,
		req: KitcmsReq,
		operation: WriteOperation,
		originalDoc: Row | undefined,
		draft = false,
	): Promise<Doc> {
		await applyDefaults(col.fields, data, { operation });
		fillSlugs(col.fields, data);
		const hookArgs = { req, operation, originalDoc: originalDoc as never };
		data = await runHooks(col.hooks.beforeValidate, { ...hookArgs, data: data as never }, 'data');
		await runFieldHooks('beforeValidate', col.fields, data, { req, operation, originalDoc });
		await validate(col, data, req, operation, originalDoc?.id, draft);
		await runFieldHooks('beforeChange', col.fields, data, { req, operation, originalDoc });
		data = await runHooks(col.hooks.beforeChange, { ...hookArgs, data: data as never }, 'data');
		// Hooks may add keys: only defined fields reach D1.
		return stripUnknown(col.fields, data);
	}

	async function afterChange(
		col: SanitizedCollection,
		stored: Row,
		previousDoc: Row | undefined,
		req: KitcmsReq,
		operation: WriteOperation,
	): Promise<Row> {
		const doc = structuredClone(stored);
		await runFieldHooks('afterChange', col.fields, doc, { req, operation, originalDoc: previousDoc });
		return runHooks(
			col.hooks.afterChange,
			{ req, operation, doc: doc as never, previousDoc: previousDoc as never },
			'doc',
		) as Promise<Row>;
	}

	/** `autosave` only makes sense for draft saves. */
	function assertWriteOpts(opts: Opts): void {
		if (opts.autosave === true && opts.draft !== true) {
			throw new QueryError('`autosave` requires `draft: true`.');
		}
	}

	/** The request for a write: `context.draft` for draft saves, plus operation flags. */
	function writeReq(col: SanitizedCollection, opts: Opts, extra: Doc = {}): KitcmsReq {
		const context = { ...(hasDrafts(col) && opts.draft === true ? { draft: true } : {}), ...extra };
		return makeReq(Object.keys(context).length > 0 ? { ...opts, context: { ...opts.context, ...context } } : opts);
	}

	/** Main row + its latest version in ONE round trip (drafts); just the row otherwise. */
	async function loadBase(
		col: SanitizedCollection,
		id: string,
		where: WhereInput | undefined,
	): Promise<{ original: Row | undefined; latest: VersionRow | null }> {
		const select = db.select({ collection: col.slug, where, limit: 1 });
		if (!hasDrafts(col)) return { original: (await db.run(select))[0], latest: null };
		const [rows, latest] = await db.batch([select, db.latestVersions(col.slug, [id])]);
		return { original: rows[0], latest: latest[0] ?? null };
	}

	/** The merge base: the latest draft when it is newer than the main row (§13.4). */
	function mergeBase(original: Row, latest: VersionRow | null, kind: WriteKind | undefined): Row {
		return !kind && latest && isNewer(latest, original) ? overlay(original, latest) : original;
	}

	/** Version statements: in-place autosave, or `latest` reset + insert + prune. */
	function versionStmts(
		col: SanitizedCollection,
		parent: string,
		data: Doc,
		status: 'draft' | 'published',
		autosave: boolean,
		latest: VersionRow | null,
		updatedAt: string,
		fresh: boolean,
	): Stmt<unknown>[] {
		if (col.versions === false) return [];
		if (autosave && latest?.autosave) {
			return [db.updateVersion(col.slug, latest.id, { version: data, updatedAt })];
		}
		const row: VersionRow = {
			id: ulid(),
			parent,
			version: data,
			autosave,
			latest: true,
			createdAt: updatedAt,
			updatedAt,
		};
		if (hasDrafts(col)) row._status = status;
		return fresh
			? [db.insertVersion(col.slug, row)]
			: [db.clearLatest(col.slug, parent), db.insertVersion(col.slug, row), db.pruneVersions(col.slug, parent, col.versions.max)];
	}

	interface PersistArgs {
		col: SanitizedCollection;
		id: string;
		req: KitcmsReq;
		opts: Opts;
		/** Access-filtered input. */
		incoming: Doc;
		/** The stored main row; `undefined` = insert. */
		original?: Row;
		latest: VersionRow | null;
		/** What `incoming` merges onto (and what hooks see as the previous doc). */
		base?: Row;
		accessWhere?: WhereInput;
		/** System columns written after the pipeline, e.g. `_order` (never from callers). */
		internal?: Doc;
		kind?: WriteKind;
	}

	/**
	 * The write half of create/update/updateGlobal/move/unpublish: hooks → validate → ONE D1 batch
	 * (main row, version rows, refs) → afterChange. Returns the changed document (not yet read).
	 */
	async function persist(a: PersistArgs): Promise<Row> {
		const { col, id, req, opts, original, latest, base, accessWhere, internal, kind } = a;
		const drafts = hasDrafts(col);
		const draft = drafts && opts.draft === true;
		const autosave = draft && opts.autosave === true;
		// Drafts skip `required`; so do the meta writes (move, unpublish) on documents that may be drafts.
		const lenient = draft || (drafts && kind !== undefined);

		if (!original) {
			const data = await prepareWrite(col, a.incoming, req, 'create', undefined, lenient);
			const now = new Date().toISOString();
			const row: Row = { ...data, ...internal, id, createdAt: now, updatedAt: now };
			if (drafts) row[STATUS_FIELD] = draft ? 'draft' : 'published';
			const stmts: Stmt<unknown>[] = [
				db.insert(col.slug, row),
				...versionStmts(col, id, data, draft ? 'draft' : 'published', autosave, null, now, true),
				db.setRefs(col.slug, id, extractRefs(col.fields, row)),
			];
			const [stored] = await db.batch(stmts);
			return afterChange(col, stored as Row, undefined, req, 'create');
		}

		const merged = { ...structuredClone(withoutSystem(base ?? original)), ...a.incoming };
		const data = await prepareWrite(col, merged, req, 'update', base ?? original, lenient);

		// Strictly newer than every stored value, so the refs guard and the draft overlay can tell.
		const prev = Math.max(
			Date.parse(original.updatedAt) || 0,
			latest ? Date.parse(latest.updatedAt) || 0 : 0,
		);
		const updatedAt = new Date(Math.max(Date.now(), prev + 1)).toISOString();

		if (kind) {
			// Meta writes never add versions. On drafts collections they must not touch `updatedAt`
			// (it orders the main row against its newest draft) nor the refs.
			let stmts: Stmt<unknown>[];
			if (kind === 'unpublish') {
				stmts = [db.update(col.slug, id, { [STATUS_FIELD]: 'draft' }, accessWhere)];
			} else if (drafts) {
				stmts = [db.update(col.slug, id, { ...internal }, accessWhere)];
			} else {
				stmts = [
					db.update(col.slug, id, { ...data, ...internal, updatedAt }, accessWhere),
					db.setRefs(col.slug, id, extractRefs(col.fields, data), { updatedAt }),
				];
			}
			const [stored] = (await db.batch(stmts)) as [Row | null];
			if (!stored) throw new NotFoundError();
			return afterChange(col, stored, original, req, 'update');
		}

		// A draft save leaves the published row alone, unless that row is itself only a draft.
		const mainUpdated = !draft || original[STATUS_FIELD] === 'draft';
		const stmts: Stmt<unknown>[] = [];
		if (mainUpdated) {
			const values: Partial<Row> = { ...data, ...internal, updatedAt };
			if (drafts && !draft) values[STATUS_FIELD] = 'published';
			stmts.push(db.update(col.slug, id, values, accessWhere));
		}
		stmts.push(...versionStmts(col, id, data, draft ? 'draft' : 'published', autosave, latest, updatedAt, false));
		const refs = mainUpdated
			? extractRefs(col.fields, data)
			: unionRefs(extractRefs(col.fields, original), extractRefs(col.fields, data));
		stmts.push(db.setRefs(col.slug, id, refs, { updatedAt: mainUpdated ? updatedAt : original.updatedAt }));

		const results = await db.batch(stmts);
		let stored: Row;
		if (mainUpdated) {
			const row = results[0] as Row | null;
			if (!row) throw new NotFoundError();
			stored = row;
		} else {
			// The published row is untouched: what was saved is the draft.
			stored = { ...data, id, createdAt: original.createdAt, updatedAt, [STATUS_FIELD]: 'draft' } as Row;
			if (ORDER_FIELD in original) stored[ORDER_FIELD] = original[ORDER_FIELD];
		}
		return afterChange(col, stored, base ?? original, req, 'update');
	}

	async function create(slug: string, input: Doc, opts: Opts = {}) {
		const col = collectionOf(slug);
		assertWriteOpts(opts);
		const req = writeReq(col, opts);
		if (!isPlainObject(input)) throw new QueryError('`data` must be an object.');
		const decision = await collectionAccess(col, 'create', {
			req,
			data: input,
			overrideAccess: opts.overrideAccess,
		});
		if (decision !== true) throw new ForbiddenError();

		const data = stripUnknown(col.fields, input);
		if (!opts.overrideAccess) {
			await applyWriteFieldAccess(col, col.fields, data, 'create', { req, root: data, topLevel: true }, undefined);
		}
		let internal: Doc | undefined;
		if (col.orderable) {
			// Append: one extra read before the insert (§13.2). Racing creates may share a key.
			internal = { [ORDER_FIELD]: keyBetween(await db.run(db.maxOrder(slug)), null) };
		}
		const changed = await persist({ col, id: ulid(), req, opts, incoming: data, latest: null, internal });
		return (await readMany(col, [changed], req, opts, false))[0];
	}

	async function update(
		slug: string,
		id: string,
		input: Doc,
		opts: Opts = {},
		/** Internal only (never from callers): system columns written after the pipeline, e.g. `_order`. */
		internal?: Doc,
		/** Internal only: `move`/`unpublish` are meta writes (no versions, no publish). */
		kind?: WriteKind,
	) {
		const col = collectionOf(slug);
		assertWriteOpts(opts);
		const req = writeReq(col, opts);
		if (!isPlainObject(input)) throw new QueryError('`data` must be an object.');
		const decision = await access(col, 'update', req, opts, { id, data: input });
		const accessWhere = decision === true ? undefined : decision;

		const { original, latest } = await loadBase(col, id, mergeWhere({ id: { equals: id } }, decision));
		if (!original) throw new NotFoundError();
		const base = mergeBase(original, latest, kind);

		const incoming = stripUnknown(col.fields, input);
		if (!opts.overrideAccess) {
			await applyWriteFieldAccess(
				col,
				col.fields,
				incoming,
				'update',
				{ req, id, root: incoming, topLevel: true },
				base,
			);
		}
		const changed = await persist({ col, id, req, opts, incoming, original, latest, base, accessWhere, internal, kind });
		return (await readMany(col, [changed], req, opts, false))[0];
	}

	async function move(slug: string, id: string, target: MoveTarget, opts: Opts = {}) {
		const col = collectionOf(slug);
		if (!col.orderable) throw new QueryError(`Collection "${slug}" is not orderable.`);
		const { before, after } = (isPlainObject(target) ? target : {}) as { before?: unknown; after?: unknown };
		const hasBefore = before !== undefined;
		const hasAfter = after !== undefined;
		const targetId = hasBefore ? before : after;
		if (hasBefore === hasAfter || typeof targetId !== 'string' || targetId === '') {
			throw new QueryError('`target` must be exactly one of `{ before: id }` or `{ after: id }`.');
		}
		if (typeof id !== 'string' || id === '') throw new NotFoundError();
		if (targetId === id) throw new QueryError('A document cannot be moved relative to itself.');

		// Deny early (before reading anything about the target); `update` re-checks with the row.
		const req = makeReq(opts);
		await access(col, 'update', req, opts, { id, data: {} });

		// The target must be readable: no probing ids the caller can't read.
		const readable = await access(col, 'read', req, opts, { id: targetId });
		const side = hasBefore ? 'before' : 'after';
		const found = await db.run(db.orderNeighbour(slug, targetId, side, id, readable === true ? undefined : readable));
		if (!found) throw new NotFoundError(`Target "${targetId}" not found.`);
		if (found.key === null) {
			throw new QueryError(
				`Target "${targetId}" has no order key yet; re-save the collection's documents or run a backfill.`,
			);
		}
		const key = hasBefore ? keyBetween(found.neighbour, found.key) : keyBetween(found.key, found.neighbour);
		return update(slug, id, {}, { ...opts, req, context: { ...opts.context, move: true } }, { [ORDER_FIELD]: key }, 'move');
	}

	/** Drafts (§13.4): takes a document offline. A meta write: hooks run, no version is added. */
	async function unpublish(slug: string, id: string, opts: Opts = {}) {
		const col = collectionOf(slug);
		if (!hasDrafts(col)) throw new QueryError(`Collection "${slug}" has no drafts.`);
		if (typeof id !== 'string' || id === '') throw new NotFoundError();
		return update(slug, id, {}, { ...opts, context: { ...opts.context, unpublish: true } }, undefined, 'unpublish');
	}

	// ----- globals (§13.1) ----------------------------------------------------------------------

	/** Globals only have boolean `read`/`update`: a `where` rule can't apply to one row, so deny. */
	async function globalAccess(
		col: SanitizedCollection,
		op: 'read' | 'update',
		req: KitcmsReq,
		opts: Opts | undefined,
		extra: { id?: string; data?: Doc } = {},
	): Promise<void> {
		const decision = await collectionAccess(col, op, { req, overrideAccess: opts?.overrideAccess, ...extra });
		if (decision !== true) throw new ForbiddenError();
	}

	async function findGlobal(slug: string, opts: Opts = {}) {
		const col = globalOf(slug);
		const req = makeReq(opts);
		await globalAccess(col, 'read', req, opts, { id: col.globalSlug });
		const draft = draftRead(col, opts, req);
		const id = col.globalSlug as string;
		let where: WhereInput = { id: { equals: id } };
		if (hasDrafts(col) && !draft) where = andWhere(where, PUBLISHED);
		const select = db.select({ collection: col.slug, where, limit: 1 });
		let stored: Row | undefined;
		if (draft) {
			const [rows, latest] = await db.batch([select, db.latestVersions(col.slug, [id])]);
			stored = rows[0];
			const v = latest[0];
			if (stored && v && isNewer(v, stored)) stored = overlay(stored, v);
		} else {
			stored = (await db.run(select))[0];
		}
		// An unsaved (or, without `draft`, unpublished) global reads as its defaults.
		const row =
			stored ??
			({ ...staticDefaults(col.fields), id, ...(hasDrafts(col) ? { [STATUS_FIELD]: 'draft' } : {}) } as unknown as Row);
		return (await readMany(col, [row], req, opts, draft))[0];
	}

	async function updateGlobal(slug: string, input: Doc, opts: Opts = {}) {
		const col = globalOf(slug);
		assertWriteOpts(opts);
		const req = writeReq(col, opts);
		if (!isPlainObject(input)) throw new QueryError('`data` must be an object.');
		const id = col.globalSlug as string;
		await globalAccess(col, 'update', req, opts, { id, data: input });

		const { original, latest } = await loadBase(col, id, { id: { equals: id } });
		const base = original ? mergeBase(original, latest, undefined) : undefined;

		const incoming = stripUnknown(col.fields, input);
		if (!opts.overrideAccess) {
			await applyWriteFieldAccess(
				col,
				col.fields,
				incoming,
				original ? 'update' : 'create',
				{ req, id, root: incoming, topLevel: true },
				base,
			);
		}
		const changed = await persist({ col, id, req, opts, incoming, original, latest, base });
		return (await readMany(col, [changed], req, opts, false))[0];
	}

	// ----- versions (§13.4) ---------------------------------------------------------------------

	function versionsOf(col: SanitizedCollection): void {
		if (col.versions === false) throw new QueryError(`"${col.globalSlug ?? col.slug}" has no versions.`);
	}

	/** Statements that must each return a row for the caller to see the parent's versions. */
	async function parentChecks(
		col: SanitizedCollection,
		id: string,
		req: KitcmsReq,
		opts: Opts | undefined,
	): Promise<Stmt<Row[]>[]> {
		const checks: Stmt<Row[]>[] = [];
		for (const op of ['read', 'update'] as const) {
			const decision = await access(col, op, req, opts, op === 'update' ? { id, data: {} } : { id });
			if (decision !== true) {
				checks.push(db.select({ collection: col.slug, where: mergeWhere({ id: { equals: id } }, decision), limit: 1 }));
			}
		}
		return checks;
	}

	async function versionDoc(col: SanitizedCollection, v: VersionRow, req: KitcmsReq, opts: Opts | undefined) {
		const version = structuredClone(v.version);
		if (!opts?.overrideAccess) await filterReadableFields(col.fields, version, req, v.parent);
		const out: Doc = { id: v.id, parent: v.parent, version };
		if (v._status !== undefined) out._status = v._status;
		out.autosave = v.autosave;
		out.latest = v.latest;
		out.createdAt = v.createdAt;
		out.updatedAt = v.updatedAt;
		return out;
	}

	async function listVersionsOf(
		col: SanitizedCollection,
		parent: string,
		checks: Stmt<Row[]>[],
		args: (Opts & Record<string, unknown>) | undefined,
		req: KitcmsReq,
	) {
		const limit = clampInt(args?.limit, DEFAULT_LIMIT, 1, MAX_VERSIONS_LIMIT, 'limit');
		const page = clampInt(args?.page, 1, 1, Number.MAX_SAFE_INTEGER, 'page');
		const [list, ...found] = (await db.batch([
			db.listVersions(col.slug, parent, limit, (page - 1) * limit),
			...checks,
		])) as [{ docs: VersionRow[]; total: number }, ...Row[][]];
		if (found.some((rows) => rows.length === 0)) throw new NotFoundError();
		const docs = await Promise.all(list.docs.map((v) => versionDoc(col, v, req, args)));
		const totalPages = Math.max(1, Math.ceil(list.total / limit));
		return {
			docs,
			totalDocs: list.total,
			limit,
			page,
			totalPages,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1,
		};
	}

	async function findVersions(slug: string, id: string, args: Opts & Record<string, unknown> = {}) {
		const col = collectionOf(slug);
		versionsOf(col);
		if (typeof id !== 'string' || id === '') throw new NotFoundError();
		const req = makeReq(args);
		return listVersionsOf(col, id, await parentChecks(col, id, req, args), args, req);
	}

	/** The raw version row, after the read + update checks on its parent. `null` = not visible. */
	async function loadVersion(
		col: SanitizedCollection,
		versionId: string,
		req: KitcmsReq,
		opts: Opts | undefined,
	): Promise<VersionRow | null> {
		versionsOf(col);
		if (typeof versionId !== 'string' || versionId === '') return null;
		const v = await db.run(db.versionById(col.slug, versionId));
		if (!v) return null;
		if (col.kind === 'global') {
			await globalAccess(col, 'read', req, opts, { id: v.parent });
			await globalAccess(col, 'update', req, opts, { id: v.parent, data: {} });
			return v;
		}
		const checks = await parentChecks(col, v.parent, req, opts);
		if (checks.length > 0) {
			const found = await db.batch(checks);
			if (found.some((rows) => rows.length === 0)) return null;
		}
		return v;
	}

	async function findVersionByID(slug: string, versionId: string, opts: Opts = {}) {
		const col = collectionOf(slug);
		const req = makeReq(opts);
		const v = await loadVersion(col, versionId, req, opts);
		return v ? versionDoc(col, v, req, opts) : null;
	}

	async function restoreVersion(slug: string, versionId: string, opts: Opts = {}) {
		const col = collectionOf(slug);
		const req = makeReq(opts);
		const v = await loadVersion(col, versionId, req, opts);
		if (!v) throw new NotFoundError();
		return update(slug, v.parent, v.version, { ...opts, req });
	}

	async function findGlobalVersions(slug: string, args: Opts & Record<string, unknown> = {}) {
		const col = globalOf(slug);
		versionsOf(col);
		const req = makeReq(args);
		const id = col.globalSlug as string;
		await globalAccess(col, 'read', req, args, { id });
		await globalAccess(col, 'update', req, args, { id, data: {} });
		return listVersionsOf(col, id, [], args, req);
	}

	async function restoreGlobalVersion(slug: string, versionId: string, opts: Opts = {}) {
		const col = globalOf(slug);
		const req = makeReq(opts);
		const v = await loadVersion(col, versionId, req, opts);
		if (!v || v.parent !== col.globalSlug) throw new NotFoundError();
		return updateGlobal(slug, v.version, { ...opts, req });
	}

	async function remove(slug: string, id: string, opts: Opts = {}) {
		const col = collectionOf(slug);
		const req = makeReq(opts);
		const decision = await access(col, 'delete', req, opts, { id });
		const accessWhere = decision === true ? undefined : decision;

		const [rows, incoming] = await db.batch([
			db.select({ collection: slug, where: mergeWhere({ id: { equals: id } }, decision), limit: 1 }),
			db.refsTo(slug, id, 10),
		]);
		const doc = rows[0];
		if (!doc) throw new NotFoundError();
		if (incoming.total > 0) {
			throw new ReferencedError(
				incoming.refs.map((r) => ({ collection: r.fromCollection, id: r.fromId, path: r.path })),
				incoming.total,
			);
		}
		await runHooks(col.hooks.beforeDelete, { req, id, doc: doc as never }, 'doc');
		const [deleted] = await db.batch([db.delete(slug, id, accessWhere), db.deleteRefsFrom(slug, id)]);
		if (!deleted) throw new NotFoundError();
		if (col.upload && ctx.storage && typeof deleted.key === 'string') {
			const cleanup = ctx.storage.delete(deleted.key).catch((err: unknown) => {
				console.error(`kitcms: failed to delete R2 object "${String(deleted.key)}"`, err);
			});
			if (ctx.waitUntil) ctx.waitUntil(cleanup);
			else await cleanup;
		}
		await runHooks(col.hooks.afterDelete, { req, id, doc: deleted as never }, 'doc');
		return readOne(col, deleted, req, opts.overrideAccess);
	}

	const api = {
		find,
		findOne,
		findByID,
		count,
		create,
		// The public update never takes the internal `_order` extra (only `move` passes it).
		update: (slug: string, id: string, input: Doc, opts?: Opts) => update(slug, id, input, opts),
		move,
		delete: remove,
		unpublish,
		findVersions,
		findVersionByID,
		restoreVersion,
		findGlobal,
		updateGlobal,
		findGlobalVersions,
		restoreGlobalVersion,
	} as unknown as Cms;
	// Edge cache (§13.9): anonymous published reads are cached; every write bumps the generation.
	// Hooks keep using the unwrapped `api` through `req.cms` (calls with `req` are never cached).
	if (!config.cache) return api;
	return withEdgeCacheLayer(api, { user: ctx.user }, {
		ttl: config.cache.ttl,
		configId: fingerprintOf(config),
		waitUntil: ctx.waitUntil,
	});
}

const fingerprints = new WeakMap<SanitizedConfig, string>();
function fingerprintOf(config: SanitizedConfig): string {
	let id = fingerprints.get(config);
	if (id === undefined) {
		id = configFingerprint(config);
		fingerprints.set(config, id);
	}
	return id;
}

/** Whether the user may use the admin panel (see ../access/engine). */
export { adminAccess };
