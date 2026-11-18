// Strict validation of a submission against a code-defined form. Pure: no I/O.
import type { EnquiryField, EnquiryForm } from './types';

export interface FieldIssue {
	path: string;
	message: string;
}

export const DEFAULT_TEXT_MAX = 200;
export const DEFAULT_TEXTAREA_MAX = 5000;
export const EMAIL_MAX = 254;

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

export function isEmail(v: string): boolean {
	return v.length <= EMAIL_MAX && EMAIL_RE.test(v);
}

export function isValidDate(v: string): boolean {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
	if (!m) return false;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const date = new Date(Date.UTC(y, mo - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function selectOptions(field: Extract<EnquiryField, { type: 'select' }>): { label: string; value: string }[] {
	return (field.options as (string | { label: string; value: string })[]).map((o) =>
		typeof o === 'string' ? { label: o, value: o } : o,
	);
}

export function maxLengthOf(field: EnquiryField): number | undefined {
	if (field.type === 'text') return field.maxLength ?? DEFAULT_TEXT_MAX;
	if (field.type === 'textarea') return field.maxLength ?? DEFAULT_TEXTAREA_MAX;
	return undefined;
}

export function labelOf(name: string, field: EnquiryField): string {
	return field.label ?? name.charAt(0).toUpperCase() + name.slice(1).replace(/[_-]+/g, ' ');
}

export type SubmittedValue = string | number | boolean;

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Validates `input` (a plain object of raw values: strings from forms, JSON types from JSON).
 * Unknown keys are dropped. Returns the cleaned data or the issues.
 */
export function validateSubmission(
	form: EnquiryForm,
	input: Record<string, unknown>,
): { data: Record<string, SubmittedValue>; issues: FieldIssue[] } {
	const data: Record<string, SubmittedValue> = {};
	const issues: FieldIssue[] = [];
	const bad = (path: string, message: string) => issues.push({ path, message });

	for (const [name, field] of Object.entries(form.fields)) {
		const label = labelOf(name, field);
		const raw = Object.hasOwn(input, name) ? input[name] : undefined;

		if (field.type === 'checkbox') {
			let checked = false;
			if (raw === true) checked = true;
			else if (typeof raw === 'string') {
				const s = raw.trim().toLowerCase();
				checked = s === 'on' || s === 'true' || s === '1' || s === 'yes';
			} else if (raw !== undefined && raw !== null && raw !== false) {
				bad(name, `${label} is invalid.`);
				continue;
			}
			if (field.required && !checked) bad(name, `${label} must be checked.`);
			else data[name] = checked;
			continue;
		}

		if (isEmpty(raw)) {
			if (field.required) bad(name, `${label} is required.`);
			continue;
		}

		switch (field.type) {
			case 'text':
			case 'textarea': {
				if (typeof raw !== 'string') {
					bad(name, `${label} is invalid.`);
					break;
				}
				const v = field.type === 'text' ? raw.trim() : raw.trim().replace(/\r\n?/g, '\n');
				const max = maxLengthOf(field)!;
				if (v.length > max) bad(name, `${label} must be at most ${max} characters.`);
				else data[name] = v;
				break;
			}
			case 'email': {
				if (typeof raw !== 'string') {
					bad(name, `${label} is invalid.`);
					break;
				}
				const v = raw.trim();
				if (!isEmail(v)) bad(name, `${label} must be a valid email address.`);
				else data[name] = v;
				break;
			}
			case 'number': {
				const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
				if (!Number.isFinite(n)) bad(name, `${label} must be a number.`);
				else if (field.integer && !Number.isInteger(n)) bad(name, `${label} must be a whole number.`);
				else if (field.min !== undefined && n < field.min) bad(name, `${label} must be at least ${field.min}.`);
				else if (field.max !== undefined && n > field.max) bad(name, `${label} must be at most ${field.max}.`);
				else data[name] = n;
				break;
			}
			case 'date': {
				const v = typeof raw === 'string' ? raw.trim() : '';
				if (!isValidDate(v)) bad(name, `${label} must be a date (YYYY-MM-DD).`);
				else data[name] = v;
				break;
			}
			case 'select': {
				const v = typeof raw === 'string' ? raw.trim() : '';
				if (!selectOptions(field).some((o) => o.value === v)) bad(name, `${label} is not a valid choice.`);
				else data[name] = v;
				break;
			}
		}
	}
	return { data, issues };
}
