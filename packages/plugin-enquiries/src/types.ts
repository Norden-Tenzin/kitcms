// Public option types of @kitcms/plugin-enquiries.
import type { Resolvable } from '@kitcms/core';

export type EnquiryField =
	| { type: 'text' | 'textarea'; label?: string; required?: boolean; maxLength?: number }
	| { type: 'email'; label?: string; required?: boolean }
	| { type: 'number'; label?: string; required?: boolean; min?: number; max?: number; integer?: boolean }
	/** `YYYY-MM-DD`. */
	| { type: 'date'; label?: string; required?: boolean }
	| {
			type: 'select';
			label?: string;
			required?: boolean;
			options: string[] | { label: string; value: string }[];
	  }
	/** `required` means the box must be checked (consent). */
	| { type: 'checkbox'; label?: string; required?: boolean };

export interface EnquiryForm {
	label: string;
	fields: Record<string, EnquiryField>;
	/**
	 * Notification recipients (sent with core's email adapter). Empty/omitted = store only. A function
	 * (Decision 36) is resolved per submission, e.g. the contact email from a global; addresses it
	 * returns that aren't valid are skipped.
	 */
	notify?: Resolvable<string[]>;
	/** Subject template; `{form}` (the form label) and `{field:name}` placeholders, single line. Default `New {form} enquiry`. */
	subject?: string;
	/** Field whose value becomes the email reply-to (must be an `email` field). */
	replyTo?: string;
}

export interface EnquiriesOptions {
	/** Forms are defined in CODE (schema locking, plan §5): never editable in the admin. Keys = form names (`/^[a-z][a-z0-9-]*$/`). */
	forms: Record<string, EnquiryForm>;
	/** Submissions collection slug. Default `'submissions'`. */
	collection?: string;
	/** Cloudflare Turnstile. When set, every submission must carry a valid token. */
	turnstile?: {
		/** The widget's site key. A function (Decision 36) is resolved per request, e.g. from a Worker var. */
		siteKey: Resolvable<string | undefined>;
		/** Worker secret name. Default `'TURNSTILE_SECRET'`. */
		secret?: string;
	};
	/** Per-IP limit for the submit endpoint. Default `{ max: 5, window: 600 }` (seconds). */
	rateLimit?: { max: number; window: number };
	/** Optional add-on gate (Decision 34) for the plugin AND its collection. */
	entitlement?: string;
}

/** The public form definition returned by `GET /api/plugins/enquiries/forms/<form>`. */
export interface PublicFormDef {
	name: string;
	label: string;
	fields: {
		name: string;
		type: EnquiryField['type'];
		label: string;
		required: boolean;
		maxLength?: number;
		min?: number;
		max?: number;
		integer?: boolean;
		options?: { label: string; value: string }[];
	}[];
	turnstileSiteKey: string | null;
}
