// Notification email: plain text + a tiny HTML table. All user values are escaped in HTML.
import type { EnquiryForm } from './types';
import { labelOf } from './validate';

export const escapeHtml = (s: string): string =>
	s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const oneLine = (s: string) => s.replace(/[\r\n\u2028\u2029]+/g, ' ').trim();

export function renderSubject(
	form: EnquiryForm,
	data: Record<string, string | number | boolean>,
): string {
	const tpl = form.subject ?? 'New {form} enquiry';
	const out = tpl
		.replace(/\{form\}/g, () => oneLine(form.label))
		.replace(/\{field:([^}]+)\}/g, (_m, name: string) => {
			const v = Object.hasOwn(data, name) ? data[name] : undefined;
			return v === undefined ? '' : oneLine(String(v));
		});
	return oneLine(out).slice(0, 200);
}

const show = (v: string | number | boolean | undefined): string =>
	v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);

export function renderEmail(
	form: EnquiryForm,
	data: Record<string, string | number | boolean>,
	meta: { page: string | null; id: string },
): { text: string; html: string } {
	const rows = Object.entries(form.fields).map(([name, field]) => ({
		label: labelOf(name, field),
		value: show(data[name]),
	}));
	const textLines = rows.map((r) => `${r.label}: ${r.value}`);
	if (meta.page) textLines.push('', `Page: ${meta.page}`);
	textLines.push(`Reference: ${meta.id}`);
	const html =
		`<h2>${escapeHtml(form.label)}</h2>` +
		'<table cellpadding="6" cellspacing="0" style="border-collapse:collapse">' +
		rows
			.map(
				(r) =>
					`<tr><th align="left" valign="top">${escapeHtml(r.label)}</th>` +
					`<td style="white-space:pre-wrap">${escapeHtml(r.value)}</td></tr>`,
			)
			.join('') +
		'</table>' +
		(meta.page ? `<p>Page: ${escapeHtml(meta.page)}</p>` : '') +
		`<p style="color:#666">Reference: ${escapeHtml(meta.id)}</p>`;
	return { text: textLines.join('\n'), html };
}
