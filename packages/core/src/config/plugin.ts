// Plugin server code (Decision 33, plan §17.1) and entitlements (Decision 34, §17.2).
// SECURITY-CRITICAL: plugin endpoints and entitlement enforcement need Opus review + tests.
//
// A plugin is a config transform (Decision 28) that may also contribute server code:
// - `handle`: runs inside `kitcms().handle` for every request OUTSIDE `/admin*` and `/api*`.
// - `endpoints`: served at `/api/plugins/<plugin name>/<path>` by the generated API route.
// - `admin.panels`: read-only panels in the admin at `/admin/plugins/<plugin name>/<panel id>`.
// Plugin code reads and writes content through the Local API it is given (one pipeline).

import type { RequestEvent } from '@sveltejs/kit';
import type { Cms } from '../api/types';
import type { Config } from './collection';
import type { KitcmsReq, KitcmsUser } from './hooks';

type MaybePromise<T> = T | Promise<T>;

/** A plugin (Decision 28 + 33). */
export interface KitcmsPlugin {
	/**
	 * Shown in config errors. Plugins with `endpoints` or `admin.panels` use it as a URL segment, so
	 * it must then be lowercase letters, digits and `-`, starting with a letter. Unique per config.
	 */
	name: string;
	/** Transforms the config (adds collections, fields, hooks, access). Runs when the config is sanitized. */
	config?: (config: Config) => Config;
	/**
	 * Runtime add-on gate (Decision 34): when `config.entitlements.has(entitlement)` is not `true`,
	 * the plugin's `handle` is skipped, its endpoints return 404 and its panels are hidden.
	 */
	entitlement?: string;
	/** Runs for site requests (never `/admin*` or `/api*`) before routing. Return a `Response` to answer. */
	handle?: PluginHandle;
	/** Served at `/api/plugins/<name>/<path>`. */
	endpoints?: PluginEndpoint[];
	admin?: {
		/** Read-only admin panels, listed in the admin navigation. */
		panels?: AdminPanelDef[];
	};
}

// ---------------------------------------------------------------------------------------------
// Handle
// ---------------------------------------------------------------------------------------------

export interface PluginHandleArgs {
	event: RequestEvent;
	/** The request path relative to the app's base path, decoded (`/about`, `/sitemap.xml`). */
	path: string;
	/** The Local API acting as the anonymous visitor. Pass `overrideAccess: true` for trusted reads. */
	cms: Cms;
}

/** Return a `Response` to answer the request (e.g. a redirect), or nothing to continue. */
export type PluginHandle = (args: PluginHandleArgs) => MaybePromise<Response | void | undefined>;

// ---------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------

export type PluginEndpointMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * Who may call an endpoint. There is no default: every endpoint states it.
 * - `public`: anyone (rate-limit it).
 * - `signedIn`: any signed-in user (401 otherwise).
 * - `admin`: users with admin access (the auth collection's `access.admin`; 401/403 otherwise).
 */
export type PluginEndpointAccess = 'public' | 'signedIn' | 'admin';

export interface PluginEndpoint {
	method: PluginEndpointMethod;
	/**
	 * Relative to `/api/plugins/<plugin name>/`: segments of `[A-Za-z0-9._-]`, or `:param`.
	 * Examples: `'submit'`, `'forms/:form'`.
	 */
	path: string;
	access: PluginEndpointAccess;
	/** Maximum request body for `ctx.body`, in bytes. Default 65536 (64 KiB), at most 1 MiB. */
	maxBodyBytes?: number;
	/**
	 * Fixed-window limit per client IP (`cf-connecting-ip`) for this endpoint, counted in D1 before
	 * the handler runs (429 when over). Fails closed if D1 is unreachable.
	 */
	rateLimit?: { max: number; /** Seconds. */ window: number };
	handler: (ctx: PluginEndpointContext) => MaybePromise<Response>;
}

/** The request body, read at most once and capped at `maxBodyBytes` (413 above it). */
export interface PluginRequestBody {
	json(): Promise<unknown>;
	form(): Promise<FormData>;
	text(): Promise<string>;
}

export interface PluginEndpointContext {
	event: RequestEvent;
	/** Values of `:param` segments, decoded. */
	params: Record<string, string>;
	/** The signed-in user, or `null`. */
	user: KitcmsUser | null;
	/** The Local API acting as the caller (anonymous for signed-out callers). */
	cms: Cms;
	body: PluginRequestBody;
	/** Email through the configured adapter (Decision 35). */
	email: EmailSender;
	/** `cf-connecting-ip`, or `null` (local dev). */
	ip: string | null;
}

// ---------------------------------------------------------------------------------------------
// Email (Decision 35)
// ---------------------------------------------------------------------------------------------

export interface EmailMessageInput {
	to: string | string[];
	subject: string;
	/** Plain-text body (always sent). */
	text: string;
	html?: string;
	replyTo?: string;
}

export interface EmailSender {
	/** `false` when `config.email` or the binding is missing: `send` then throws `EmailNotConfiguredError`. */
	readonly enabled: boolean;
	send(message: EmailMessageInput): Promise<{ messageId: string | null }>;
}

// ---------------------------------------------------------------------------------------------
// Admin panels (read-only)
// ---------------------------------------------------------------------------------------------

export interface AdminPanelDef {
	/** URL segment: lowercase letters, digits and `-`. Unique within the plugin. */
	id: string;
	label: string;
	/** Navigation group. */
	group?: string;
	/** Who may see the panel. Default: every user with admin access. */
	access?: (args: { req: KitcmsReq }) => MaybePromise<boolean>;
	/** The panel's content for this request. Read-only: there are no actions. */
	load: (args: { req: KitcmsReq; cms: Cms }) => MaybePromise<PanelContent>;
}

export type PanelTone = 'default' | 'ok' | 'warning' | 'muted';

/** Serializable panel content. Core validates it before it reaches the browser. */
export interface PanelContent {
	blocks: PanelBlock[];
}

export type PanelBlock =
	| { type: 'heading'; text: string }
	| { type: 'text'; text: string; tone?: PanelTone }
	| { type: 'keyValue'; items: { label: string; value: string; tone?: PanelTone }[] }
	| {
			type: 'meter';
			label: string;
			used: number;
			/** `null` = unlimited. */
			limit: number | null;
			/** Shown after the numbers, e.g. `documents`. `bytes` formats as KB/MB/GB. */
			unit?: string;
	  }
	| {
			type: 'list';
			items: { label: string; description?: string; status?: 'on' | 'off' | 'locked' }[];
	  }
	/** `href` must be `https:` or `/`-relative; anything else is dropped. */
	| { type: 'link'; label: string; href: string };

// ---------------------------------------------------------------------------------------------
// Entitlements (Decision 34)
// ---------------------------------------------------------------------------------------------

/**
 * Answers "is this add-on on for this deployment?". Set as `config.entitlements` by
 * `@kitcms/plugin-entitlements`. Anything but `true` (including a throw) means off.
 * Called on every gated check: cache inside.
 */
export interface EntitlementsProvider {
	has(addon: string): MaybePromise<boolean>;
}
