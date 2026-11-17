// Admin form encoding (the "form-state model", plan §4.9 / §4.1 Phase 0 rules).
//
// The edit form is a plain HTML form, so it works without JS. Every input's `name` is the field's
// dot path from the document root: `title`, `seo.metaTitle`, `sections.0.heading`,
// `sections.0.blockType`, `sections.0.id`, `tags` (repeated for hasMany).
// Rules the field components follow and `parseFormData` relies on:
// - A field is PRESENT when the form has its `path`, its marker `path.__present`, or any key
//   under `path.`. Absent fields are omitted from the result, so an update keeps their stored
//   value (fields the user can't read, read-only and hidden fields are simply not submitted).
// - Checkboxes, hasMany relationships and containers (group/array/blocks) always render the
//   marker, so "unchecked" / "empty list" is distinguishable from "absent".
// - Array/blocks rows are taken in DOM order (the order keys first appear), not by index value,
//   so reordering rows only has to keep each row's index unique.
// - Values are coerced by field type. Unparseable input is kept raw (validation reports it), except
//   JSON fields, whose parse errors are returned as field errors.

import type { AnyField, Mode } from '../config/sanitized';
import type { FieldError } from '../errors';
import { FORM } from './types';

type Field = AnyField<Mode>;
type Data = Record<string, unknown>;

const MARKER = '__present';

/** Index of the form's keys, built once per parse. */
class FormIndex {
	readonly keys: string[];
	constructor(readonly form: FormData) {
		this.keys = [...new Set(form.keys())];
	}
	has(path: string): boolean {
		const prefix = `${path}.`;
		return (
			this.form.has(path) ||
			this.form.has(`${path}.${MARKER}`) ||
			this.keys.some((k) => k.startsWith(prefix))
		);
	}
	/** The last string value (a hidden fallback followed by the real input wins). */
	get(path: string): string | undefined {
		const all = this.form.getAll(path).filter((v): v is string => typeof v === 'string');
		return all.at(-1);
	}
	getAll(path: string): string[] {
		return this.form.getAll(path).filter((v): v is string => typeof v === 'string');
	}
	/** Distinct row index segments under `path.`, in first-appearance order. */
	rows(path: string): string[] {
		const prefix = `${path}.`;
		const seen: string[] = [];
		for (const k of this.keys) {
			if (!k.startsWith(prefix)) continue;
			const seg = k.slice(prefix.length).split('.')[0];
			if (seg === undefined || !/^\d+$/.test(seg) || seen.includes(seg)) continue;
			seen.push(seg);
		}
		return seen;
	}
}

function coerceDate(raw: string): string {
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00.000Z`;
	// datetime-local without a zone: treated as UTC (the JS admin submits full ISO strings).
	const withZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) ? `${raw}Z` : raw;
	const ms = Date.parse(withZone);
	return Number.isNaN(ms) ? raw : new Date(ms).toISOString();
}

function parseFields(
	fields: readonly Field[],
	ix: FormIndex,
	prefix: string,
	errors: FieldError[],
): Data {
	const out: Data = {};
	for (const field of fields) {
		const path = prefix ? `${prefix}.${field.name}` : field.name;
		if (!ix.has(path)) continue;
		const raw = ix.get(path);
		switch (field.type) {
			case 'text':
			case 'textarea':
			case 'email':
			case 'slug':
			case 'select':
				out[field.name] = raw === undefined || raw === '' ? null : raw;
				break;
			case 'number': {
				if (raw === undefined || raw.trim() === '') out[field.name] = null;
				else {
					const n = Number(raw);
					out[field.name] = Number.isNaN(n) ? raw : n;
				}
				break;
			}
			case 'checkbox':
				out[field.name] = raw === 'on' || raw === 'true';
				break;
			case 'date':
				out[field.name] = raw === undefined || raw === '' ? null : coerceDate(raw);
				break;
			case 'json':
			case 'richText': {
				if (raw === undefined || raw.trim() === '') {
					out[field.name] = null;
					break;
				}
				try {
					out[field.name] = JSON.parse(raw) as unknown;
				} catch {
					errors.push({ path, message: 'Must be valid JSON' });
					out[field.name] = raw;
				}
				break;
			}
			case 'relationship':
			case 'upload':
				if (field.hasMany) out[field.name] = ix.getAll(path).filter((v) => v !== '');
				else out[field.name] = raw === undefined || raw === '' ? null : raw;
				break;
			case 'group':
				out[field.name] = parseFields(field.fields, ix, path, errors);
				break;
			case 'array':
				out[field.name] = ix.rows(path).map((i) => {
					const rowPath = `${path}.${i}`;
					const row = parseFields(field.fields, ix, rowPath, errors);
					const id = ix.get(`${rowPath}.id`);
					return id ? { id, ...row } : row;
				});
				break;
			case 'blocks':
				out[field.name] = ix.rows(path).map((i) => {
					const rowPath = `${path}.${i}`;
					const blockType = ix.get(`${rowPath}.blockType`) ?? '';
					const block = field.blocks.find((b) => b.slug === blockType);
					const row = block ? parseFields(block.fields, ix, rowPath, errors) : {};
					const id = ix.get(`${rowPath}.id`);
					return id ? { id, blockType, ...row } : { blockType, ...row };
				});
				break;
		}
	}
	return out;
}

/**
 * Parses an admin form submission into document data (only the fields present in the form) plus
 * JSON parse errors. Paths in `errors` match the validator's paths.
 */
export function parseFormData(
	fields: readonly Field[],
	form: FormData,
): { data: Data; errors: FieldError[] } {
	const errors: FieldError[] = [];
	const data = parseFields(fields, new FormIndex(form), '', errors);
	return { data, errors };
}

/** A string value from a form, `''` when missing. */
export function formString(form: FormData, key: string): string {
	const v = form.get(key);
	return typeof v === 'string' ? v : '';
}

export { FORM };
