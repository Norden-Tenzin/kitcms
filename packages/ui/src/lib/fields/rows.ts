// Shared helpers for repeating containers (array rows, blocks).
import type { ClientField } from '@kitcms/core/client';

export type Row = Record<string, unknown>;

export function newId(): string {
	return globalThis.crypto.randomUUID();
}

/** The empty value for a field in a new row. Containers initialise themselves, so they get an empty shell. */
export function emptyValue(field: ClientField): unknown {
	switch (field.type) {
		case 'checkbox':
			return false;
		case 'group':
			return {};
		case 'array':
		case 'blocks':
			return [];
		case 'relationship':
		case 'upload':
			return field.hasMany ? [] : null;
		default:
			return null;
	}
}

export function emptyRow(fields: ClientField[], extra: Row = {}): Row {
	const row: Row = { id: newId(), ...extra };
	for (const f of fields) row[f.name] = emptyValue(f);
	return row;
}

/**
 * A deep copy of a row with a fresh id (nested rows keep theirs; ids only need to be unique per
 * container). Pass `$state.snapshot(row)`, a plain object.
 */
export function cloneRow(snapshot: Row): Row {
	return { ...structuredClone(snapshot), id: newId() };
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
	if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
	const next = [...list];
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item as T);
	return next;
}

/** A short row label from the first text-like field that has a value. */
export function rowSummary(fields: ClientField[], row: Row): string {
	for (const f of fields) {
		if (f.type === 'text' || f.type === 'textarea' || f.type === 'email' || f.type === 'slug') {
			const v = row[f.name];
			if (typeof v === 'string' && v.trim()) {
				const t = v.trim().replace(/\s+/g, ' ');
				return t.length > 60 ? `${t.slice(0, 57)}...` : t;
			}
		}
	}
	return '';
}

export function idOf(v: unknown): string | null {
	if (typeof v === 'string') return v || null;
	if (v && typeof v === 'object' && 'id' in v && typeof (v as { id: unknown }).id === 'string') {
		return (v as { id: string }).id || null;
	}
	return null;
}
