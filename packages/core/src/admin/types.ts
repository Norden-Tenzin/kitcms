// The admin contract shared by core (producer: load + actions) and @kitcms/ui (consumer).
// Browser-safe: types only.

import type { ClientCollection, SanitizedBranding } from '../config/sanitized';
import type { FieldError } from '../errors';
import type { PanelContent } from '../config/plugin';

export type AdminRoute =
	| { view: 'login' }
	| { view: 'create-first-user' }
	/** "Forgot password": asks for an email and sends a reset link (Decision 37). */
	| { view: 'forgot-password' }
	/** Opened from a reset or invite link: `?token=...`. */
	| { view: 'reset-password' }
	| { view: 'dashboard' }
	| { view: 'list'; collection: string }
	| { view: 'create'; collection: string }
	| { view: 'edit'; collection: string; id: string }
	| { view: 'global'; global: string }
	| { view: 'versions'; collection: string; id: string; global?: undefined }
	| { view: 'versions'; global: string; collection?: undefined; id?: undefined }
	/** A plugin's read-only panel (Decision 33): `/admin/plugins/<plugin>/<panel>`. */
	| { view: 'panel'; plugin: string; panel: string };

export type AdminDoc = Record<string, unknown> & { id: string };

export interface AdminNavItem {
	/** Collections: the collection slug. Globals (in `globals` lists): the public global slug. */
	slug: string;
	label: string;
	group?: string;
}

/** Where a document of a collection/global with drafts stands (§13.4). `changed` = published with a newer draft. */
export type AdminDocStatus = 'draft' | 'published' | 'changed';

/** One row of the versions view. */
export interface AdminVersion {
	id: string;
	/** Drafts collections/globals only. */
	status?: 'draft' | 'published';
	autosave: boolean;
	latest: boolean;
	createdAt: string;
	/** The version's title field value, when readable. */
	label?: string;
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
	/** `admin.branding` from the config (§13.6): logo and accent colours, already validated. */
	branding: SanitizedBranding;
	/** The deployment is read-only (`KITCMS_READ_ONLY`): show it, and offer no writes. */
	readOnly?: boolean;
}

interface SignedIn extends Base {
	user: AdminUser;
	nav: AdminNavItem[];
	/** Visible globals (`/admin/globals/:slug`), in config order. */
	globals: AdminNavItem[];
	/** Plugin panels the user may see (`/admin/plugins/:plugin/:id`), in config order. */
	panels: AdminPanelNavItem[];
}

export interface AdminPanelNavItem {
	plugin: string;
	id: string;
	label: string;
	group?: string;
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
	| (Base & { route: { view: 'login' }; /** Email is set up, so "forgot password" can work. */ emailEnabled?: boolean })
	| (Base & { route: { view: 'create-first-user' } })
	| (Base & { route: { view: 'forgot-password' }; emailEnabled: boolean })
	| (Base & {
			route: { view: 'reset-password' };
			/** The token from the link (posted back with the form); `''` when missing. */
			token: string;
			/** `null`: the link is invalid, used or expired. */
			link: { kind: 'reset' | 'invite'; email: string } | null;
	  })
	| (SignedIn & {
			route: { view: 'dashboard' };
			/** Plugin panels marked `dashboard: true`, loaded and validated. */
			dashboardPanels: { plugin: string; id: string; label: string; content: PanelContent }[];
			collections: (AdminNavItem & { description?: string; totalDocs: number })[];
			globals: (AdminNavItem & { description?: string })[];
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
			/** Auth collection + email set up: a new user can be invited by email instead of given a password. */
			canInvite?: boolean;
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
			/** Collections with drafts only. */
			status?: AdminDocStatus;
			/** Number of stored versions; absent when there are none to see (no versions, or no update access). */
			versionCount?: number;
	  })
	| (SignedIn & {
			route: { view: 'global'; global: string };
			/** The global as a client collection (`slug` is its table name `_global_<slug>`, `kind: 'global'`). */
			collection: ClientCollection;
			/** `create`/`delete` are always false for globals. */
			permissions: AdminPermissions;
			/** The stored global, or its static defaults when never saved (`id` = the global slug). */
			doc: AdminDoc;
			hiddenFields: string[];
			/** Globals with drafts only. */
			status?: AdminDocStatus;
			versionCount?: number;
	  })
	| (SignedIn & {
			route: { view: 'panel'; plugin: string; panel: string };
			/** Validated, read-only content (unsafe links already dropped). */
			panel: { label: string; content: PanelContent };
	  })
	| (SignedIn & {
			route: Extract<AdminRoute, { view: 'versions' }>;
			/** The collection, or the global as a client collection. */
			collection: ClientCollection;
			permissions: AdminPermissions;
			/** Title of the document the versions belong to. */
			docTitle: string;
			versions: AdminVersion[];
			totalDocs: number;
			page: number;
			totalPages: number;
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
	/** `forgotPassword` finished: show the neutral "if the account exists" message. */
	resetRequested?: boolean;
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
	/** Auth collection create: email a set-password invite instead of setting a password. */
	invite: '__invite',
	currentPassword: '__currentPassword',
	/** Bulk delete: repeated, one per selected id. */
	ids: '__ids',
	/** Save as a draft instead of publishing (§13.4). The name of the "Save draft" submit button. */
	draft: '__draft',
	/** With `draft`: this is an autosave (updates the latest autosave version in place). */
	autosave: '__autosave',
	/** The version to restore (the `restoreVersion` action). */
	versionId: '__versionId',
} as const;
