export interface EnquiryState {
	readonly status: 'idle' | 'submitting' | 'success' | 'error';
	/** A message for the visitor (success text or the error). Empty while idle. */
	readonly message: string;
	/** Field errors by field name (`turnstile` for the spam check). */
	readonly errors: Record<string, string>;
	/** Back to `idle`, clearing the message and errors. */
	reset(): void;
}

/** The error text of one field, or `undefined`. Use it for `aria-invalid` / `aria-describedby`. */
export function fieldError(state: Pick<EnquiryState, 'errors'>, name: string): string | undefined {
	return Object.hasOwn(state.errors, name) ? state.errors[name] : undefined;
}
