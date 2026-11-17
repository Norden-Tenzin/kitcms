<script lang="ts">
	// Date (`picker: 'day'`) or date and time (`picker: 'dayAndTime'`). Same structure as TextField
	// (the reference); see ./types.ts for the contract.
	//
	// The stored value is an ISO string (`2026-11-16T00:00:00.000Z`). Day pickers store UTC midnight.
	// Date-time pickers convert the browser's local time to UTC ISO.
	//
	// Form submission: the visible input has `name={path}` and submits `YYYY-MM-DD` or the local
	// `YYYY-MM-DDTHH:mm`, which carries no timezone. A hidden input with the exact ISO value is
	// rendered AFTER it, only when there is a value. The server takes the last value for a name, so
	// the ISO string wins. With JS disabled the visible input still submits, and the hidden one is
	// absent only when the value is empty (then the visible empty string means null).
	import type { FieldOf } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import FieldShell from './FieldShell.svelte';
	import { fieldId, type FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'date', 'client'>> = $props();

	const ctx = getFormContext();
	const id = $derived(fieldId(path));
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);
	const describedBy = $derived(
		[field.admin.description && `${id}-desc`, ctx.errors[path] && `${id}-err`].filter(Boolean).join(' ') ||
			undefined,
	);
	const dayAndTime = $derived(field.admin.picker === 'dayAndTime');
	const iso = $derived(typeof value === 'string' ? value : '');

	const pad = (n: number) => String(n).padStart(2, '0');

	const get = (): string => {
		const d = new Date(iso);
		if (iso === '' || Number.isNaN(d.getTime())) return '';
		if (!dayAndTime) return d.toISOString().slice(0, 10);
		// Local wall-clock time for <input type="datetime-local">.
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	};
	const set = (v: string) => {
		if (v === '') {
			value = null;
			return;
		}
		if (!dayAndTime) {
			value = `${v}T00:00:00.000Z`;
			return;
		}
		// `new Date` reads a date-time without offset as local time. Invalid input is kept raw so the
		// server reports it.
		const d = new Date(v);
		value = Number.isNaN(d.getTime()) ? v : d.toISOString();
	};
</script>

<FieldShell {field} {path}>
	<input
		{id}
		class="kc-input"
		type={dayAndTime ? 'datetime-local' : 'date'}
		name={path}
		bind:value={get, set}
		required={field.required}
		disabled={readOnly}
		aria-invalid={ctx.errors[path] ? 'true' : undefined}
		aria-describedby={describedBy}
	/>
	{#if iso !== ''}
		<input type="hidden" name={path} value={iso} disabled={readOnly} />
	{/if}
</FieldShell>
