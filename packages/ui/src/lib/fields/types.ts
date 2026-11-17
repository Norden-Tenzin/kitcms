// THE FIELD COMPONENT CONTRACT (plan §7 "Admin architecture").
//
// One Svelte 5 component per field type, registered in ./registry.ts. Each receives:
//   field  the client field config (`FieldOf<'text', 'client'>` etc.)
//   path   the dot path from the document root. It is the input `name` AND the error key:
//          `title`, `seo.metaTitle`, `sections.0.heading`.
//   value  the current value, `$bindable()`. The edit view owns the form state (one `$state`
//          object seeded from the document at creation); components read and write it through
//          `bind:value`. Never copy it into local state in an `$effect`.
// and reads the rest from `getFormContext()` (errors, read-only, mode).
//
// Rules (see @kitcms/core/src/admin/form.ts for the server side):
// - Submit real form inputs named `path`, so the form works without JS. Values are coerced on
//   the server by field type; complex widgets submit a hidden input with the serialized value
//   (JSON for json/richText, one hidden input per id for hasMany).
// - Checkboxes, hasMany relationships and containers also render the presence marker
//   `<input type="hidden" name={FORM.marker(path)}>`, so "unchecked"/"empty" isn't "absent".
// - Read-only (`field.admin.readOnly || ctx.readOnly`): render `disabled` inputs. Disabled inputs
//   aren't submitted, so the stored value is kept.
// - Wrap the input in <FieldShell> (label, required mark, description, error, ids for a11y).
//   The input's `id` is `fieldId(path)`; the error/description are linked via aria-describedby.
// - Use only the admin CSS variables (`--kc-*`) for styling; never global selectors.

import type { ClientField } from '@kitcms/core/client';

export interface FieldProps<F extends ClientField = ClientField> {
	field: F;
	path: string;
	value: unknown;
}

/** A DOM id for a field path (paths contain dots, which are valid in ids but awkward in CSS). */
export function fieldId(path: string): string {
	return `kc-f-${path.replaceAll('.', '-')}`;
}
