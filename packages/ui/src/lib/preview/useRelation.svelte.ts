// `useRelation(collection, () => id)`: resolves a relationship/upload id inside a preview component
// to its picker doc (`title`, and for uploads `url`, `width`, `height`, `mimeType`). Reactive:
// re-resolves when the id changes. Lookups are batched per collection and cached (./relations.ts).
// Call it during component initialisation (it uses an effect), never on the server (no effect runs).
import type { PickerDoc } from '../fields/relation/api';
import { fetchRelation, peekRelation } from './relations';

export interface RelationState {
	/** The resolved doc; `undefined` while loading, when there is no id, or when it doesn't exist. */
	readonly current: PickerDoc | undefined;
	readonly loading: boolean;
}

export function useRelation(collection: string, id: () => string | null | undefined): RelationState {
	let current = $state.raw<PickerDoc | undefined>();
	let loading = $state(false);

	$effect(() => {
		const wanted = id();
		if (!wanted) {
			current = undefined;
			loading = false;
			return;
		}
		const cached = peekRelation(collection, wanted);
		if (cached !== undefined) {
			current = cached ?? undefined;
			loading = false;
			return;
		}
		let live = true;
		loading = true;
		fetchRelation(collection, wanted).then(
			(doc) => {
				if (!live) return;
				current = doc ?? undefined;
				loading = false;
			},
			() => {
				if (!live) return;
				current = undefined;
				loading = false;
			},
		);
		return () => {
			live = false;
		};
	});

	return {
		get current() {
			return current;
		},
		get loading() {
			return loading;
		},
	};
}
