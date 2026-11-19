// POST /api/upload/:collection. Origin, session and admin access are checked by the caller
// (sveltekit/api.ts); collection access, hooks and validation still run through the Local API.
import type { RequestEvent } from '@sveltejs/kit';
import { markUploadWrite, UPLOAD_FIELDS } from '../access/engine';
import { parseFormData } from '../admin/form';
import type { KitcmsReq } from '../config/hooks';
import { isKitcmsError, ReadOnlyError, ValidationError, type FieldError } from '../errors';
import { isReadOnly } from '../runtime';
import type { KitcmsInternals } from '../sveltekit/index';
import { ulid } from '../ulid';
import {
	clientDimension,
	detectMime,
	makeKey,
	mimeAllowed,
	parseDimensions,
} from './sniff';

const OVERHEAD = 1024 * 1024;
const HEAD_BYTES = 64 * 1024;

function fail(status: number, error: string, errors?: FieldError[]): Response {
	return Response.json(errors ? { error, errors } : { error }, {
		status,
		headers: { 'cache-control': 'no-store' },
	});
}

function formValue(form: FormData, key: string): string | null {
	const v = form.get(key);
	return typeof v === 'string' ? v : null;
}

export async function handleUpload(
	event: RequestEvent,
	k: KitcmsInternals,
	slug: string,
): Promise<Response> {
	const col = k.config.collectionsBySlug[slug];
	if (!col) return fail(404, `Unknown collection "${slug}".`);
	if (!col.upload) return fail(400, `Collection "${slug}" does not accept uploads.`);
	// Refuse before touching R2 (the write itself would be refused too, after the upload).
	if (isReadOnly(k.env)) return fail(403, new ReadOnlyError().message);
	const storage = k.storage;
	if (!storage || !k.user) return fail(500, 'File storage is not configured.');
	const { mimeTypes, maxFileSize } = col.upload;

	const declared = Number(event.request.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > maxFileSize + OVERHEAD) {
		return fail(413, `The file is larger than ${maxFileSize} bytes.`);
	}
	const ctype = event.request.headers.get('content-type') ?? '';
	if (!ctype.toLowerCase().startsWith('multipart/form-data')) return fail(400, 'Expected multipart/form-data.');

	let form: FormData;
	try {
		form = await event.request.formData();
	} catch {
		return fail(400, 'Invalid form data.');
	}
	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0) return fail(400, 'A non-empty "file" is required.');
	if (file.size > maxFileSize) return fail(413, `The file is larger than ${maxFileSize} bytes.`);

	const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
	const mimeType = detectMime(head, file.type);
	if (!mimeAllowed(mimeType, mimeTypes)) return fail(415, `Files of type ${mimeType} are not allowed here.`);

	const dims = parseDimensions(head, mimeType);
	const width = dims?.width ?? clientDimension(formValue(form, 'width'));
	const height = dims?.height ?? clientDimension(formValue(form, 'height'));
	const sized = dims || (width && height);

	const userFields = col.fields.filter((f) => !(UPLOAD_FIELDS as readonly string[]).includes(f.name));
	const parsed = parseFormData(userFields, form);
	if (parsed.errors.length) return fail(400, 'The document has invalid fields.', parsed.errors);

	const key = makeKey(ulid(), file.name);
	const data: Record<string, unknown> = {
		...parsed.data,
		filename: file.name.split(/[\\/]/).pop()?.slice(0, 255) || 'file',
		mimeType,
		filesize: file.size,
		width: sized ? width : null,
		height: sized ? height : null,
		key,
	};

	const cms = k.cmsFor(k.user, 'admin');
	const req: KitcmsReq = { user: k.user, context: {}, cms, source: 'admin', event };
	markUploadWrite(req);

	const id = formValue(form, 'id');
	try {
		let oldKey: string | null = null;
		if (id) {
			const existing = await cms.findByID(slug, id);
			if (!existing) return fail(404, 'Document not found.');
			oldKey = typeof existing.key === 'string' ? existing.key : null;
		}
		await storage.put(key, await file.arrayBuffer(), { contentType: mimeType, size: file.size });
		let doc: Record<string, unknown>;
		try {
			doc = (
				id ? await cms.update(slug, id, data, { req }) : await cms.create(slug, data, { req })
			) as Record<string, unknown>;
		} catch (err) {
			await storage.delete(key).catch(() => {});
			throw err;
		}
		if (oldKey && oldKey !== key) await storage.delete(oldKey).catch(() => {});
		if (typeof doc.url !== 'string') doc = { ...doc, url: storage.url(key) };
		const picker = {
			id: String(doc.id),
			title: String(doc[col.admin.useAsTitle] || doc.id),
			url: doc.url as string,
			mimeType,
			filename: data.filename as string,
			width: data.width as number | null,
			height: data.height as number | null,
		};
		return Response.json({ ...picker, doc }, { status: id ? 200 : 201, headers: { 'cache-control': 'no-store' } });
	} catch (err) {
		if (err instanceof ValidationError) return fail(400, err.message, err.errors);
		if (isKitcmsError(err)) return fail(err.status, err.message);
		throw err;
	}
}
