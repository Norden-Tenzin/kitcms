// The edit form's shared state, provided by the edit view and read by every field component.
import { getContext, setContext } from 'svelte';
import type { ClientCollection } from '@kitcms/core/client';

export interface FormContext {
	collection: ClientCollection;
	mode: 'create' | 'edit' | 'global';
	/** The whole form is read-only (the user may not update this document). */
	readOnly: boolean;
	/** Error message per dot path (`sections.0.heading`). A `$state` object owned by the edit view. */
	errors: Record<string, string>;
	/** Top-level fields hidden by a server-side `admin.condition` (Decision 19). */
	hidden: ReadonlySet<string>;
}

const KEY = Symbol('kitcms-form');

export function setFormContext(ctx: FormContext): FormContext {
	return setContext(KEY, ctx);
}

export function getFormContext(): FormContext {
	const ctx = getContext<FormContext | undefined>(KEY);
	if (!ctx) throw new Error('kitcms: field components must be rendered inside the edit form');
	return ctx;
}
