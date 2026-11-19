// Errors thrown by kitcms. Runtime-agnostic (no Node APIs), safe to import in the browser.
// Every error has a stable `code` and an HTTP-like `status` so the admin, REST and RPC layers can
// map them without `instanceof` across module copies.

export type KitcmsErrorCode =
	| 'CONFIG'
	| 'VALIDATION'
	| 'FORBIDDEN'
	| 'UNAUTHORIZED'
	| 'NOT_FOUND'
	| 'REFERENCED'
	| 'QUERY';

export class KitcmsError extends Error {
	readonly code: KitcmsErrorCode;
	readonly status: number;
	constructor(code: KitcmsErrorCode, status: number, message: string) {
		super(message);
		this.name = 'KitcmsError';
		this.code = code;
		this.status = status;
	}
}

/** The config itself is invalid. `path` points at the offending option, e.g. `collections.pages.fields.title`. */
export class ConfigError extends KitcmsError {
	readonly path: string;
	constructor(path: string, message: string) {
		super('CONFIG', 500, `kitcms config: ${path}: ${message}`);
		this.name = 'ConfigError';
		this.path = path;
	}
}

/** One invalid value. `path` is dot-separated from the document root, with array indexes: `sections.0.heading`. */
export interface FieldError {
	path: string;
	message: string;
}

export class ValidationError extends KitcmsError {
	readonly errors: FieldError[];
	constructor(errors: FieldError[], message = 'The document has invalid fields.') {
		super('VALIDATION', 400, message);
		this.name = 'ValidationError';
		this.errors = errors;
	}
}

export class ForbiddenError extends KitcmsError {
	constructor(message = 'You are not allowed to perform this action.') {
		super('FORBIDDEN', 403, message);
		this.name = 'ForbiddenError';
	}
}

/**
 * Thrown by every write while the deployment is read-only (`KITCMS_READ_ONLY`, e.g. a site whose
 * subscription is paused). Reads, sign-in and sign-out keep working.
 */
export class ReadOnlyError extends ForbiddenError {
	constructor(message = 'This website is paused, so changes are switched off.') {
		super(message);
		this.name = 'ReadOnlyError';
	}
}

export class UnauthorizedError extends KitcmsError {
	constructor(message = 'Sign in to continue.') {
		super('UNAUTHORIZED', 401, message);
		this.name = 'UnauthorizedError';
	}
}

export class NotFoundError extends KitcmsError {
	constructor(message = 'Not found.') {
		super('NOT_FOUND', 404, message);
		this.name = 'NotFoundError';
	}
}

/** A document can't be deleted while others reference it (see the `_refs` table). */
export class ReferencedError extends KitcmsError {
	readonly references: { collection: string; id: string; path: string }[];
	readonly total: number;
	constructor(references: { collection: string; id: string; path: string }[], total: number) {
		super('REFERENCED', 409, `Still used in ${total} place${total === 1 ? '' : 's'}.`);
		this.name = 'ReferencedError';
		this.references = references;
		this.total = total;
	}
}

/** An invalid query from an untyped caller (unknown field, bad operator, bad value). */
export class QueryError extends KitcmsError {
	constructor(message: string) {
		super('QUERY', 400, message);
		this.name = 'QueryError';
	}
}

export function isKitcmsError(err: unknown): err is KitcmsError {
	return (
		err instanceof Error &&
		typeof (err as Partial<KitcmsError>).code === 'string' &&
		typeof (err as Partial<KitcmsError>).status === 'number'
	);
}
