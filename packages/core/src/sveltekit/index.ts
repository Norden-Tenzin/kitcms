// SPIKE (Phase 0): the shape of kitcms's SvelteKit integration.
// `kitcms(...)` returns a `handle` that puts the Local API on `event.locals.cms`, serves Better Auth under
// /api/auth/*, and resolves the session for /admin and /api only.
// Package-provided route modules (admin, api) only ever talk to `locals.cms` and `locals.user`.
import { building } from '$app/env';
import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { authConfigured, configureAuth, getAuth, isAuthPath, type KitcmsAuthOptions } from './auth';
import { needsSession, type Role } from './auth-guard';

export type Doc = Record<string, unknown> & { id: string };
export type { KitcmsAuthOptions } from './auth';
export type { Role } from './auth-guard';

export interface KitcmsCollectionMeta {
	slug: string;
	/** Text fields the spike admin can edit. Phase 1 replaces this with the field component contract. */
	editable: string[];
	useAsTitle: string;
}

/** SPIKE contract for the Local API as seen by package code. Phase 1 replaces it with the real typed API. */
export interface KitcmsLocal {
	collections: KitcmsCollectionMeta[];
	find(collection: string, opts?: { limit?: number }): Promise<{ docs: Doc[] }>;
	findByID(collection: string, id: string): Promise<Doc | null>;
	update(collection: string, id: string, data: Record<string, unknown>): Promise<Doc>;
}

/** The signed-in user. `role` is whatever is stored: guards must check it with `isRole`. Never carries credentials. */
export interface KitcmsUser {
	id: string;
	email: string;
	name: string;
	role: Role | (string & {});
}

/** The current session. Deliberately has no token: the cookie is the only place it is visible. */
export interface KitcmsSession {
	id: string;
	expiresAt: Date;
}

declare global {
	namespace App {
		interface Locals {
			cms: KitcmsLocal;
			/** Only resolved for /admin and /api requests; `null` on public routes and when signed out. */
			user: KitcmsUser | null;
			session: KitcmsSession | null;
		}
	}
}

export interface KitcmsOptions {
	/** Builds the per-request Local API. In Phase 1 this is internal: built from the config + D1/R2 bindings. */
	create: (event: RequestEvent) => KitcmsLocal;
	/** Better Auth (email + password) on D1. */
	auth: KitcmsAuthOptions;
}

function pathOf(event: RequestEvent): string {
	try {
		return decodeURI(event.url.pathname);
	} catch {
		return event.url.pathname;
	}
}

export function kitcms(options: KitcmsOptions): { handle: Handle } {
	configureAuth(options.auth);
	return {
		handle: async ({ event, resolve }) => {
			event.locals.cms = options.create(event);
			event.locals.user = null;
			event.locals.session = null;

			if (authConfigured()) {
				const pathname = pathOf(event);
				// Better Auth's own endpoints (sign-in, sign-out, session...). Sign-up is disabled in its config.
				if (isAuthPath(pathname)) {
					return svelteKitHandler({ auth: getAuth(), event, resolve, building });
				}
				if (needsSession(pathname)) {
					const result = await getAuth().api.getSession({ headers: event.request.headers });
					if (result) {
						const { user, session } = result;
						event.locals.user = {
							id: user.id,
							email: user.email,
							name: user.name,
							role: user.role,
						};
						event.locals.session = { id: session.id, expiresAt: session.expiresAt };
					}
				}
			}
			return resolve(event);
		},
	};
}
