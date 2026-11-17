// The operation pipeline and the Local API (plan §4.3, §4.6).
// Every entry point (Local API, RPC, REST, admin actions) calls these operations:
//
//   create:  access(create) → strip unknown → field write access → defaults → slugs
//            → beforeValidate → validate → beforeChange → D1 (insert + refs, 1 batch)
//            → afterChange → read pipeline
//   update:  access(update) → load stored doc (1 round trip) → field write access → merge
//            → defaults → slugs → beforeValidate → validate → beforeChange
//            → D1 (update + refs, 1 batch) → afterChange → read pipeline
//   delete:  access(delete) → load + incoming refs (1 batch) → beforeDelete
//            → D1 (delete + refs, 1 batch) → afterDelete
//   read:    access(read) → D1 (rows + count, 1 batch) → read pipeline → populate
//            (1 batch per depth level, across all target collections)
//   read pipeline, per doc: beforeRead → field read access → field afterRead → file url
//            → afterRead
//
// Round-trip budget (§11): a depth-1 populated read is 2 sequential D1 round trips; writes are 2.

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
import type { SanitizedCollection, SanitizedConfig, SanitizedField } from '../config/sanitized';
import type { WhereInput } from '../config/where';
import type { DbAdapter, Row } from '../db/adapter';
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
import { extractRefs } from '../refs/extract';
import { ulid } from '../ulid';
import { collectRelationIds, replaceRelationIds } from './populate';
import type { Cms, OperationOptions } from './types';

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
type Opts = OperationOptions & { depth?: number };

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 10;
const MAX_DEPTH = 2;
const SYSTEM_KEYS = new Set(['id', 'createdAt', 'updatedAt']);

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

export function createLocalApi(ctx: CmsContext): Cms {
	const { config, db } = ctx;

	function collectionOf(slug: unknown): SanitizedCollection {
		const col = typeof slug === 'string' ? config.collectionsBySlug[slug] : undefined;
		if (!col) throw new NotFoundError(`Unknown collection "${String(slug)}".`);
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
	): Promise<void> {
		const skip = (path: string, field: SanitizedField) => hiddenByCondition(data, path, field);
		const errors: FieldError[] = validateDocument(col.fields, data, {
			skip: skip as (path: string, field: unknown) => boolean,
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
			targets.push({ col, ids: [...set], where: decision === true ? undefined : decision });
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
		await populate(fetched, depth - 1, req, override);

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
	): Promise<Doc[]> {
		const depth = clampInt(opts?.depth, 0, 0, MAX_DEPTH, 'depth');
		const docs = await Promise.all(rows.map((r) => readOne(col, r, req, opts?.overrideAccess)));
		const item = { col, docs };
		await populate([item], depth, req, opts?.overrideAccess);
		return item.docs;
	}

	// ----- operations ---------------------------------------------------------------------------

	async function find(slug: string, args: Opts & Record<string, unknown> = {}) {
		const col = collectionOf(slug);
		const req = makeReq(args);
		const decision = await access(col, 'read', req, args);
		const sort = parseSort(args.sort, col.defaultSort);
		await assertQueryable(col, args.where as WhereInput | undefined, sort, req, args.overrideAccess);
		const where = mergeWhere(args.where as WhereInput | undefined, decision);
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
		const docs = await readMany(col, rows, req, args);
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
		const where = mergeWhere({ id: { equals: id } }, decision);
		const rows = await db.run(db.select({ collection: slug, where, limit: 1 }));
		if (rows.length === 0) return null;
		return (await readMany(col, rows, req, opts))[0] ?? null;
	}

	async function count(slug: string, args: Opts & { where?: WhereInput } = {}) {
		const col = collectionOf(slug);
		const req = makeReq(args);
		const decision = await access(col, 'read', req, args);
		await assertQueryable(col, args.where, [], req, args.overrideAccess);
		return db.run(db.count({ collection: slug, where: mergeWhere(args.where, decision) }));
	}

	async function prepareWrite(
		col: SanitizedCollection,
		data: Doc,
		req: KitcmsReq,
		operation: WriteOperation,
		originalDoc: Row | undefined,
	): Promise<Doc> {
		await applyDefaults(col.fields, data, { operation });
		fillSlugs(col.fields, data);
		const hookArgs = { req, operation, originalDoc: originalDoc as never };
		data = await runHooks(col.hooks.beforeValidate, { ...hookArgs, data: data as never }, 'data');
		await runFieldHooks('beforeValidate', col.fields, data, { req, operation, originalDoc });
		await validate(col, data, req, operation, originalDoc?.id);
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

	async function create(slug: string, input: Doc, opts: Opts = {}) {
		const col = collectionOf(slug);
		const req = makeReq(opts);
		if (!isPlainObject(input)) throw new QueryError('`data` must be an object.');
		const decision = await collectionAccess(col, 'create', {
			req,
			data: input,
			overrideAccess: opts.overrideAccess,
		});
		if (decision !== true) throw new ForbiddenError();

		let data = stripUnknown(col.fields, input);
		if (!opts.overrideAccess) {
			await applyWriteFieldAccess(col, col.fields, data, 'create', { req, root: data, topLevel: true }, undefined);
		}
		data = await prepareWrite(col, data, req, 'create', undefined);

		const now = new Date().toISOString();
		const row: Row = { ...data, id: ulid(), createdAt: now, updatedAt: now };
		const [stored] = await db.batch([
			db.insert(slug, row),
			db.setRefs(slug, row.id, extractRefs(col.fields, row)),
		]);
		const changed = await afterChange(col, stored, undefined, req, 'create');
		return (await readMany(col, [changed], req, opts))[0];
	}

	async function update(slug: string, id: string, input: Doc, opts: Opts = {}) {
		const col = collectionOf(slug);
		const req = makeReq(opts);
		if (!isPlainObject(input)) throw new QueryError('`data` must be an object.');
		const decision = await access(col, 'update', req, opts, { id, data: input });
		const accessWhere = decision === true ? undefined : decision;

		const [original] = await db.run(
			db.select({ collection: slug, where: mergeWhere({ id: { equals: id } }, decision), limit: 1 }),
		);
		if (!original) throw new NotFoundError();

		const incoming = stripUnknown(col.fields, input);
		if (!opts.overrideAccess) {
			await applyWriteFieldAccess(
				col,
				col.fields,
				incoming,
				'update',
				{ req, id, root: incoming, topLevel: true },
				original,
			);
		}
		const merged = { ...structuredClone(withoutSystem(original)), ...incoming };
		const data = await prepareWrite(col, merged, req, 'update', original);

		// Strictly newer than the stored value, so the refs guard can tell the write happened.
		const prev = Date.parse(original.updatedAt);
		const updatedAt = new Date(Math.max(Date.now(), (Number.isNaN(prev) ? 0 : prev) + 1)).toISOString();
		const [stored] = await db.batch([
			db.update(slug, id, { ...data, updatedAt }, accessWhere),
			db.setRefs(slug, id, extractRefs(col.fields, data), { updatedAt }),
		]);
		if (!stored) throw new NotFoundError();
		const changed = await afterChange(col, stored, original, req, 'update');
		return (await readMany(col, [changed], req, opts))[0];
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
		update,
		delete: remove,
	} as unknown as Cms;
	return api;
}

/** Whether the user may use the admin panel (see ../access/engine). */
export { adminAccess };
