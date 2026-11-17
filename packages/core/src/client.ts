// @kitcms/core/client: browser-safe exports for the admin UI (no server code, no Node APIs).
export { validateDocument, validateValue, messages, slugify, isEmpty } from './fields/validate';
export { FORM } from './admin/types';
export type * from './admin/types';
export type {
	AnyField,
	AnyBlock,
	AnyCollection,
	ClientField,
	ClientCollection,
	ClientConfig,
	ClientFieldAdmin,
	FieldOf,
	LayoutNode,
	Labels,
	Mode,
} from './config/sanitized';
export type { FieldError } from './errors';
