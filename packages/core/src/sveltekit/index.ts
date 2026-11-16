// SPIKE (Phase 0): the shape of kitcms's SvelteKit integration.
// `kitcms(...)` returns a `handle` that puts the Local API on `event.locals.cms`.
// Package-provided route modules (admin, api) only ever talk to `locals.cms`.
import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';

export type Doc = Record<string, unknown> & { id: string };

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

declare global {
	namespace App {
		interface Locals {
			cms: KitcmsLocal;
		}
	}
}

export interface KitcmsOptions {
	/** Builds the per-request Local API. In Phase 1 this is internal: built from the config + D1/R2 bindings. */
	create: (event: RequestEvent) => KitcmsLocal;
}

export function kitcms(options: KitcmsOptions): { handle: Handle } {
	return {
		handle: ({ event, resolve }) => {
			event.locals.cms = options.create(event);
			return resolve(event);
		},
	};
}
