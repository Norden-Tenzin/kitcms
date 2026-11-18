// Shared by the enquiry forms in the config (`kitcms.config.ts`) and the site (`BookingForm.svelte`).
// The form definitions live in code (plugin-enquiries), so the room options do too: keep them in step
// with the seeded room types (the values are the room slugs).
export const ROOM_OPTIONS = [
	{ label: 'Orchard room', value: 'orchard-room' },
	{ label: 'Mountain-view room', value: 'mountain-view-room' },
	{ label: 'Stupa-view rooftop room', value: 'stupa-view-rooftop-room' },
	{ label: 'Family suite', value: 'family-suite' },
];

/** `?room=` can carry a slug or a name: returns the option value, or ''. */
export function roomValue(input: string | null | undefined): string {
	const v = (input ?? '').trim().toLowerCase();
	if (!v) return '';
	return ROOM_OPTIONS.find((o) => o.value === v || o.label.toLowerCase() === v)?.value ?? '';
}

const words = (slug: string | null | undefined) => {
	const text = (slug ?? '').replace(/[^a-z0-9-]/gi, '').replace(/-/g, ' ').trim();
	return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
};

/**
 * `?offer=stay-seven` and `?experience=thiksey-at-dawn` become the first line of the message:
 * "I am asking about the offer: Stay seven."
 */
export function prefillMessage(opts: { offer?: string | null; experience?: string | null }): string {
	const lines: string[] = [];
	if (words(opts.offer)) lines.push(`I am asking about the offer: ${words(opts.offer)}.`);
	if (words(opts.experience)) lines.push(`I am asking about the experience: ${words(opts.experience)}.`);
	return lines.length ? `${lines.join('\n')}\n` : '';
}
