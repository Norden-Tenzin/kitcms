// Lazy component loading with a per-loader cache. Browser only (called from effects).
import type { Component } from 'svelte';

// Preview components have caller-defined props, so the loader is typed loosely here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = Component<any>;
export type AnyLoader = () => Promise<{ default: AnyComponent }>;

const cache = new WeakMap<object, Promise<AnyComponent>>();

export function loadComponent(loader: AnyLoader): Promise<AnyComponent> {
	let p = cache.get(loader);
	if (!p) {
		p = loader().then((m) => m.default);
		const mine = p;
		// A failed import is not cached, so a retry (or a fixed HMR) can succeed.
		mine.catch(() => cache.delete(loader));
		cache.set(loader, mine);
	}
	return p;
}
