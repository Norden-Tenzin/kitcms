import type { CollectionDef, Config, KitcmsPlugin, PluginEndpoint, PluginEndpointContext } from '@kitcms/core';
import { collection, fields as f, ValidationError } from '@kitcms/core';
import { deps } from './deps';
import { renderEmail, renderSubject } from './email';
import { jsonError, pageTarget, redirectWith } from './respond';
import { verifyTurnstile } from './turnstile';
import type { EnquiriesOptions, EnquiryForm, PublicFormDef } from './types';
import {
	isEmail,
	labelOf,
	maxLengthOf,
	selectOptions,
	validateSubmission,
	type SubmittedValue,
} from './validate';

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const SLUG_RE = /^[a-z][a-z0-9-]*$/;
const FIELD_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const RESERVED = new Set(['_page', '_hp', 'turnstiletoken']);
const TYPES = new Set(['text', 'textarea', 'email', 'number', 'date', 'select', 'checkbox']);

const fail = (msg: string): never => {
	throw new Error(`enquiries: ${msg}`);
};

const isAdmin = ({ req }: { req: { user: { role: string } | null } }) => req.user?.role === 'admin';

/** Throws on a malformed options object (called when the plugin is created). */
function validateOptions(options: EnquiriesOptions): void {
	const forms = Object.entries(options.forms ?? {});
	if (forms.length === 0) fail('define at least one form in `forms`.');
	if (options.collection !== undefined && !SLUG_RE.test(options.collection))
		fail(`collection "${options.collection}" must be lowercase letters, digits and "-".`);
	if (options.turnstile && !options.turnstile.siteKey) fail('turnstile.siteKey is required.');
	if (options.turnstile?.secret !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(options.turnstile.secret))
		fail('turnstile.secret must be a Worker secret name.');
	const rl = options.rateLimit;
	if (rl && !(Number.isInteger(rl.max) && rl.max > 0 && Number.isInteger(rl.window) && rl.window > 0))
		fail('rateLimit needs positive integers `max` and `window` (seconds).');

	for (const [name, form] of forms) {
		if (!NAME_RE.test(name)) fail(`form name "${name}" must match ${NAME_RE}.`);
		if (!form.label?.trim()) fail(`form "${name}" needs a label.`);
		const fields = Object.entries(form.fields ?? {});
		if (fields.length === 0) fail(`form "${name}" needs at least one field.`);
		for (const [fname, field] of fields) {
			const where = `form "${name}", field "${fname}"`;
			if (!FIELD_RE.test(fname) || RESERVED.has(fname.toLowerCase()))
				fail(`${where}: invalid field name (letters, digits and "_", starting with a letter; "_page", "_hp" and "turnstileToken" are reserved).`);
			if (!TYPES.has(field.type)) fail(`${where}: unknown type "${String((field as { type: unknown }).type)}".`);
			if (field.type === 'select') {
				const opts = selectOptions(field);
				if (!Array.isArray(field.options) || opts.length === 0) fail(`${where}: select needs at least one option.`);
				const values = opts.map((o) => o?.value);
				if (values.some((v) => typeof v !== 'string' || v === '') || new Set(values).size !== values.length)
					fail(`${where}: select options must be unique non-empty strings.`);
			}
			if (field.type === 'text' || field.type === 'textarea') {
				if (field.maxLength !== undefined && !(Number.isInteger(field.maxLength) && field.maxLength > 0))
					fail(`${where}: maxLength must be a positive integer.`);
			}
			if (field.type === 'number' && field.min !== undefined && field.max !== undefined && field.min > field.max)
				fail(`${where}: min is greater than max.`);
		}
		if (form.replyTo !== undefined && form.fields[form.replyTo]?.type !== 'email')
			fail(`form "${name}": replyTo "${form.replyTo}" must be an email field of the form.`);
		for (const addr of form.notify ?? [])
			if (!isEmail(addr)) fail(`form "${name}": "${addr}" is not a valid notify address.`);
		if (form.subject !== undefined) {
			if (/[\r\n]/.test(form.subject)) fail(`form "${name}": subject must be a single line.`);
			for (const m of form.subject.matchAll(/\{field:([^}]+)\}/g))
				if (!form.fields[m[1]!]) fail(`form "${name}": subject references unknown field "${m[1]}".`);
		}
	}
}

function submissionsCollection(options: EnquiriesOptions, slug: string): CollectionDef {
	const formNames = Object.keys(options.forms);
	const readOnly = { access: { update: () => false } };
	return collection({
		slug,
		labels: { singular: 'Submission', plural: 'Submissions' },
		admin: {
			group: 'Enquiries',
			description: 'Messages sent from the website forms. Read-only except for the status.',
			useAsTitle: 'email',
			defaultColumns: ['form', 'name', 'email', 'status', 'createdAt'],
		},
		// Submissions are created only by the plugin endpoint (overrideAccess). No public read/create.
		access: { read: isAdmin, create: () => false, update: isAdmin, delete: isAdmin },
		defaultSort: '-createdAt',
		...(options.entitlement ? { entitlement: options.entitlement } : {}),
		fields: {
			form: f.select({
				options: formNames,
				required: true,
				...readOnly,
				admin: { position: 'sidebar', readOnly: true },
			}),
			name: f.text({ maxLength: 200, ...readOnly, admin: { readOnly: true } }),
			email: f.text({ maxLength: 254, ...readOnly, admin: { readOnly: true } }),
			data: f.json({
				...readOnly,
				admin: { readOnly: true, description: 'What the visitor sent.' },
			}),
			page: f.text({ maxLength: 500, ...readOnly, admin: { readOnly: true, position: 'sidebar' } }),
			status: f.select({
				options: [
					{ label: 'New', value: 'new' },
					{ label: 'Handled', value: 'handled' },
				],
				required: true,
				defaultValue: 'new',
				access: { update: isAdmin },
				admin: { position: 'sidebar' },
			}),
			notified: f.checkbox({
				defaultValue: false,
				...readOnly,
				admin: { readOnly: true, position: 'sidebar', description: 'A notification email was sent.' },
			}),
		},
	} as never) as unknown as CollectionDef;
}

function publicForm(name: string, form: EnquiryForm, siteKey: string | null): PublicFormDef {
	return {
		name,
		label: form.label,
		fields: Object.entries(form.fields).map(([fname, field]) => {
			const max = maxLengthOf(field);
			return {
				name: fname,
				type: field.type,
				label: labelOf(fname, field),
				required: field.required === true,
				...(max !== undefined ? { maxLength: max } : {}),
				...(field.type === 'number'
					? {
							...(field.min !== undefined ? { min: field.min } : {}),
							...(field.max !== undefined ? { max: field.max } : {}),
							...(field.integer ? { integer: true } : {}),
						}
					: {}),
				...(field.type === 'select' ? { options: selectOptions(field) } : {}),
			};
		}),
		turnstileSiteKey: siteKey,
	};
}

const isFormContent = (ct: string) =>
	ct.startsWith('application/x-www-form-urlencoded') || ct.startsWith('multipart/form-data');

/** Reads the body into a plain object. Throws a `Response` for 400s. */
async function readInput(ctx: PluginEndpointContext): Promise<{ input: Record<string, unknown>; isForm: boolean }> {
	const ct = (ctx.event.request.headers.get('content-type') ?? '').toLowerCase();
	if (isFormContent(ct)) {
		const fd = await ctx.body.form(); // invalid data → core maps its ValidationError to 400
		const input: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
		for (const [k, v] of fd.entries()) {
			if (typeof v !== 'string') throw new ValidationError([{ path: k, message: 'File uploads are not accepted.' }]);
			if (!Object.hasOwn(input, k)) input[k] = v; // first value wins
		}
		return { input, isForm: true };
	}
	if (ct.startsWith('application/json')) {
		const json = await ctx.body.json(); // invalid JSON → core maps ValidationError to 400
		if (json === null || typeof json !== 'object' || Array.isArray(json))
			throw new ValidationError([{ path: '', message: 'The body must be a JSON object.' }]);
		const input: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
		for (const [k, v] of Object.entries(json)) input[k] = v;
		return { input, isForm: false };
	}
	throw jsonError(415, 'Send application/json or a form post.');
}

/**
 * Enquiry forms with spam protection (honeypot, optional Turnstile, per-IP rate limit) and email
 * notifications. Adds the `submissions` collection and `/api/plugins/enquiries/*` endpoints.
 */
export function enquiries(options: EnquiriesOptions): KitcmsPlugin {
	validateOptions(options);
	const slug = options.collection ?? 'submissions';
	const forms = new Map(Object.entries(options.forms));
	const siteKey = options.turnstile?.siteKey ?? null;
	const secretName = options.turnstile?.secret ?? 'TURNSTILE_SECRET';

	const submit: PluginEndpoint = {
		method: 'POST',
		path: 'submit/:form',
		access: 'public',
		maxBodyBytes: 16 * 1024,
		rateLimit: options.rateLimit ?? { max: 5, window: 600 },
		async handler(ctx) {
			const name = ctx.params.form!;
			const form = forms.get(name);
			if (!form) return jsonError(404, 'Unknown form.');

			const req = ctx.event.request;
			const origin = ctx.event.url.origin;
			let parsed: Awaited<ReturnType<typeof readInput>>;
			try {
				parsed = await readInput(ctx);
			} catch (err) {
				if (err instanceof Response) return err;
				throw err;
			}
			const { input, isForm } = parsed;
			const wantsHtml = isForm && (req.headers.get('accept') ?? '').includes('text/html');
			const pagePath = pageTarget(input._page, req.headers.get('referer'), origin);
			const target = pagePath ?? '/';
			const done = (): Response =>
				wantsHtml
					? redirectWith(target, { enquiry: 'sent' })
					: Response.json(
							{ ok: true, message: 'Thank you. Your message has been sent.' },
							{ headers: { 'cache-control': 'no-store' } },
						);
			const invalid = (error: string, errors: { path: string; message: string }[]): Response => {
				if (!wantsHtml) throw new ValidationError(errors, error); // core answers 400 { error, errors }
				return redirectWith(target, { enquiry: 'error', fields: errors.map((e) => e.path).join(',') });
			};

			// Honeypot: look successful, store nothing.
			const hp = input._hp;
			if (hp !== undefined && hp !== null && String(hp) !== '') return done();

			const { data, issues } = validateSubmission(form, input);
			if (issues.length) return invalid('The submission has invalid fields.', issues);

			if (options.turnstile) {
				const token =
					typeof input['cf-turnstile-response'] === 'string'
						? input['cf-turnstile-response']
						: typeof input.turnstileToken === 'string'
							? input.turnstileToken
							: null;
				const result = await verifyTurnstile(secretName, token, ctx.ip);
				if (result === 'no-secret') {
					console.error(`kitcms enquiries: the Worker secret "${secretName}" is not set; rejecting submissions.`);
					return jsonError(500, 'Form submissions are temporarily unavailable.');
				}
				if (result === 'unavailable') return jsonError(503, 'Could not verify the request. Try again.');
				if (result === 'invalid')
					return invalid('The spam check failed. Reload the page and try again.', [
						{ path: 'turnstile', message: 'The spam check failed.' },
					]);
			}

			const firstEmailField = Object.entries(form.fields).find(([, fd]) => fd.type === 'email')?.[0];
			const emailCopy = firstEmailField ? data[firstEmailField] : undefined;
			const nameCopy = form.fields.name?.type === 'text' ? data.name : undefined;

			const doc = (await ctx.cms.create(
				slug as never,
				{
					form: name,
					data,
					status: 'new',
					notified: false,
					...(typeof emailCopy === 'string' ? { email: emailCopy } : {}),
					...(typeof nameCopy === 'string' ? { name: nameCopy } : {}),
					...(pagePath ? { page: pagePath.split('?')[0]!.slice(0, 500) } : {}),
				} as never,
				{ overrideAccess: true },
			)) as unknown as { id: string };

			if (form.notify?.length && ctx.email.enabled) {
				const task = notify(ctx, slug, doc.id, form, data, pagePath);
				if (!(await deps.waitUntil(task))) await task;
			}
			return done();
		},
	};

	const definition: PluginEndpoint = {
		method: 'GET',
		path: 'forms/:form',
		access: 'public',
		handler(ctx) {
			const name = ctx.params.form!;
			const form = forms.get(name);
			if (!form) return jsonError(404, 'Unknown form.');
			return Response.json(publicForm(name, form, siteKey), {
				headers: { 'cache-control': 'public, max-age=300' },
			});
		},
	};

	return {
		name: 'enquiries',
		...(options.entitlement ? { entitlement: options.entitlement } : {}),
		config(config: Config): Config {
			const existing = (config.collections ?? []) as readonly CollectionDef[];
			if (existing.some((c) => c.slug === slug))
				fail(`the collection "${slug}" already exists. Pass \`collection\` to use another slug.`);
			return { ...config, collections: [...existing, submissionsCollection(options, slug)] };
		},
		endpoints: [submit, definition],
	};
}

/** Sends the notification; never throws (an email failure must not fail the submission). */
async function notify(
	ctx: PluginEndpointContext,
	slug: string,
	id: string,
	form: EnquiryForm,
	data: Record<string, SubmittedValue>,
	page: string | null,
): Promise<void> {
	try {
		const { text, html } = renderEmail(form, data, { page, id });
		const reply = form.replyTo ? data[form.replyTo] : undefined;
		await ctx.email.send({
			to: form.notify!,
			subject: renderSubject(form, data),
			text,
			html,
			...(typeof reply === 'string' ? { replyTo: reply } : {}),
		});
		await ctx.cms.update(slug as never, id, { notified: true } as never, { overrideAccess: true });
	} catch (err) {
		console.error('kitcms enquiries: notification failed:', err instanceof Error ? err.message : 'unknown error');
	}
}
