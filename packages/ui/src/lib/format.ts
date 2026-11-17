// Cell formatting for the list view.
import type { ClientCollection, ClientField } from '@kitcms/core/client';

const SYSTEM_LABELS: Record<string, string> = {
	id: 'ID',
	createdAt: 'Created',
	updatedAt: 'Updated',
	_status: 'Status',
};

/** Collections/globals with drafts (§13.4). `versions` is absent on hand-built test fixtures. */
export function hasDrafts(collection: ClientCollection): boolean {
	const v = collection.versions as ClientCollection['versions'] | undefined;
	return v !== undefined && v !== false && v.drafts !== false;
}

/** The autosave interval in ms, or 0 when autosave is off. */
export function autosaveInterval(collection: ClientCollection): number {
	const v = collection.versions as ClientCollection['versions'] | undefined;
	if (!v || v.drafts === false || v.drafts.autosave === false) return 0;
	return v.drafts.autosave.interval;
}

export function columnLabel(collection: ClientCollection, name: string): string {
	const field = collection.fields.find((f) => f.name === name);
	return field?.label ?? SYSTEM_LABELS[name] ?? name;
}

/** System columns and column-stored fields can be sorted; JSON-ish fields can't. */
export function isSortable(collection: ClientCollection, name: string): boolean {
	if (name in SYSTEM_LABELS) return true;
	const t = collection.fields.find((f) => f.name === name)?.type;
	return (
		t === 'text' ||
		t === 'textarea' ||
		t === 'email' ||
		t === 'slug' ||
		t === 'number' ||
		t === 'checkbox' ||
		t === 'select' ||
		t === 'date'
	);
}

// Fixed locale and zone so server-rendered and hydrated output match.
const dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
const dateTimeFmt = new Intl.DateTimeFormat('en', {
	dateStyle: 'medium',
	timeStyle: 'short',
	timeZone: 'UTC',
});

function formatDate(v: unknown, withTime: boolean): string {
	const d = new Date(typeof v === 'number' ? v : String(v));
	if (Number.isNaN(d.getTime())) return String(v);
	return (withTime ? dateTimeFmt : dateFmt).format(d);
}

export function shortId(id: unknown): string {
	const s = String(id);
	return s.length > 8 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

export function formatCell(collection: ClientCollection, name: string, value: unknown): string {
	if (value === null || value === undefined || value === '') return '—';
	if (name === 'id') return shortId(value);
	if (name === '_status') return value === 'published' ? 'Published' : value === 'changed' ? 'Changed' : 'Draft';
	if (name === 'createdAt' || name === 'updatedAt') return formatDate(value, true);
	const field: ClientField | undefined = collection.fields.find((f) => f.name === name);
	if (!field) return String(value);
	switch (field.type) {
		case 'date':
			return formatDate(value, field.admin.picker === 'dayAndTime');
		case 'checkbox':
			return value ? '✓' : '';
		case 'select':
			return field.options.find((o) => o.value === value)?.label ?? String(value);
		case 'relationship':
		case 'upload':
			return Array.isArray(value) ? value.map(shortId).join(', ') || '—' : shortId(value);
		case 'group':
		case 'array':
		case 'blocks':
		case 'json':
		case 'richText':
			return '—';
		default: {
			const s = String(value);
			return s.length > 80 ? `${s.slice(0, 80)}…` : s;
		}
	}
}
