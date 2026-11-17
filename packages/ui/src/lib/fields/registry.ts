// Field type → component. Every data field type must have an entry before the admin ships.
import type { Component } from 'svelte';
import type { ClientField } from '@kitcms/core/client';
import JsonField from './JsonField.svelte';
import TextField from './TextField.svelte';
import TextareaField from './TextareaField.svelte';
import EmailField from './EmailField.svelte';
import NumberField from './NumberField.svelte';
import CheckboxField from './CheckboxField.svelte';
import SelectField from './SelectField.svelte';
import DateField from './DateField.svelte';
import SlugField from './SlugField.svelte';
import GroupField from './GroupField.svelte';
import ArrayField from './ArrayField.svelte';
import BlocksField from './BlocksField.svelte';
import RelationshipField from './RelationshipField.svelte';
import UploadField from './UploadField.svelte';
import RichTextField from './RichTextField.svelte';
import type { FieldProps } from './types';

// Components are typed per field type; the renderer only ever passes the matching field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFieldComponent = Component<FieldProps<any>, object, 'value'>;

export const fieldComponents: Partial<Record<ClientField['type'], AnyFieldComponent>> = {
	text: TextField,
	json: JsonField,
	textarea: TextareaField,
	email: EmailField,
	number: NumberField,
	checkbox: CheckboxField,
	select: SelectField,
	date: DateField,
	slug: SlugField,
	group: GroupField,
	array: ArrayField,
	blocks: BlocksField,
	relationship: RelationshipField,
	upload: UploadField,
	richText: RichTextField,
};
