// The admin contract shared by core (producer: load + actions) and @kitcms/ui (consumer).
// Browser-safe: types only.

import type { ClientCollection } from '../config/sanitized';
import type { FieldError } from '../errors';

export type AdminRoute =
	| { view: 'login' }
	| { view: 'create-first-user' }
	| { view: 'dashboard' }
	| { view: 'list'; collection: string }
	| { view: 'create'; collection: string }
	| { view: 'edit'; collection: string; id: string };

export type AdminDoc = Record<string, unknown> & { id: string };

export interface AdminNavItem {
	slug: string;
	label: string;
	group?: string;
}

export interface AdminUser {
	id: string;
	email: string;
	name: string;
	role: string;
}

/** What the user may do in the current collection. A `where`-based rule counts as "may". */
export interface AdminPermissions {
	create: boolean;
	update: boolean;
	delete: boolean;
}

interface Base {
	title: string;
}

interface SignedIn extends Base {
	user: AdminUser;
	nav: AdminNavItem[];
}

export interface ListQuery {
	page: number;
	limit: number;
	/** `'title'` or `'-title'`. */
	sort: string;
	/** Search text, matched against the collection's `listSearchableFields`. */
	q: string;
	/** Upload collections: `grid` (default) or `table`. */
	view?: 'grid' | 'table';
}

/** What the admin `load` returns, discriminated by `route.view`. */
export type AdminData =
	| (Base & { route: { view: 'login' } })
	| (Base & { route: { view: 'create-first-user' } })
	| (SignedIn & {
			route: { view: 'dashboard' };
			collections: (AdminNavItem & { description?: string; totalDocs: number })[];
	  })
	| (SignedIn & {
			route: { view: 'list'; collection: string };
			collection: ClientCollection;
			permissions: AdminPermissions;
			query: ListQuery;
			docs: AdminDoc[];
			totalDocs: number;
			totalPages: number;
	  })
	| (SignedIn & {
			route: { view: 'create'; collection: string };
			collection: ClientCollection;
			permissions: AdminPermissions;
			/** Initial form values (static defaults applied on the server). */
			doc: Record<string, unknown>;
	  })
	| (SignedIn & {
			route: { view: 'edit'; collection: string; id: string };
			collection: ClientCollection;
			permissions: AdminPermissions;
			/** The stored document as the user may read it. Fields they can't read are absent. */
			doc: AdminDoc;
			/** Top-level field names hidden by a server-side `admin.condition` right now. */
			hiddenFields: string[];
			/** Whether this is the signed-in user's own document in the auth collection. */
			isSelf: boolean;
	  });

export type AdminDataOf<V extends AdminData['route']['view']> = Extract<
	AdminData,
	{ route: { view: V } }
>;

/** Action results (`form` prop). Success and failure shapes share optional keys. */
export interface AdminActionData {
	/** `save` succeeded (update; create redirects to the new document). */
	saved?: boolean;
	/** `setPassword` succeeded. */
	passwordChanged?: boolean;
	/** A message for the whole form (auth errors, forbidden, referenced). */
	message?: string;
	/** Field errors, by dot path (`sections.0.heading`). */
	errors?: FieldError[];
	/**
	 * The submitted values after parsing, returned on failure so the form re-renders with the
	 * user's input (needed without JS, where the page reloads).
	 */
	values?: Record<string, unknown>;
	/** Documents still referencing the one that couldn't be deleted. */
	references?: { collection: string; id: string; path: string }[];
}

/** Admin form conventions (see ../admin/form.ts). */
export const FORM = {
	/** Hidden marker rendered by container fields (group/array/blocks/hasMany) so an empty value is still "present". */
	marker: (path: string) => `${path}.__present`,
	/** The form field carrying the auth collection's password on create and in setPassword. */
	password: '__password',
	currentPassword: '__currentPassword',
	/** Bulk delete: repeated, one per selected id. */
	ids: '__ids',
} as const;
