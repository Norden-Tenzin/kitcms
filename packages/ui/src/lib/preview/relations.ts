// The batching + caching core behind `useRelation` (plain module, no runes, so it is testable).
// Lookups requested in the same microtask for one collection become one `lookupDocs` call. Results
// (including "not found") are cached for the page's lifetime, so repeated ids never refetch.
import { lookupDocs, type PickerDoc } from '../fields/relation/api';

type Entry = { doc: PickerDoc | null } | { pending: Promise<PickerDoc | null> };

const cache = new Map<string, Entry>();
const waiters = new Map<string, Map<string, Array<{ ok: (d: PickerDoc | null) => void; fail: (e: unknown) => void }>>>();
let scheduled = false;

const key = (collection: string, id: string) => `${collection}\u0000${id}`;

/** The cached doc, synchronously: `undefined` when not loaded yet, `null` when it doesn't exist. */
export function peekRelation(collection: string, id: string): PickerDoc | null | undefined {
	const e = cache.get(key(collection, id));
	return e && 'doc' in e ? e.doc : undefined;
}

async function flush() {
	scheduled = false;
	const batches = [...waiters];
	waiters.clear();
	await Promise.all(
		batches.map(async ([collection, byId]) => {
			const ids = [...byId.keys()];
			try {
				const docs = await lookupDocs(collection, ids);
				const found = new Map(docs.map((d) => [d.id, d]));
				for (const [id, list] of byId) {
					const doc = found.get(id) ?? null;
					cache.set(key(collection, id), { doc });
					for (const w of list) w.ok(doc);
				}
			} catch (e) {
				for (const [id, list] of byId) {
					cache.delete(key(collection, id)); // allow a retry later
					for (const w of list) w.fail(e);
				}
			}
		}),
	);
}

/** Resolve one doc by id (cached, batched per collection per microtask). */
export function fetchRelation(collection: string, id: string): Promise<PickerDoc | null> {
	const k = key(collection, id);
	const hit = cache.get(k);
	if (hit) return 'doc' in hit ? Promise.resolve(hit.doc) : hit.pending;
	const pending = new Promise<PickerDoc | null>((ok, fail) => {
		let byId = waiters.get(collection);
		if (!byId) waiters.set(collection, (byId = new Map()));
		let list = byId.get(id);
		if (!list) byId.set(id, (list = []));
		list.push({ ok, fail });
	});
	cache.set(k, { pending });
	if (!scheduled) {
		scheduled = true;
		queueMicrotask(() => void flush());
	}
	return pending;
}

/** Test helper: forget everything. */
export function clearRelationCache() {
	cache.clear();
	waiters.clear();
	scheduled = false;
}
