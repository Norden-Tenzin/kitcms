// Shared by the enquiry forms in the config (`kitcms.config.ts`) and the site's brief form.
// Form definitions live in code (plugin-enquiries), so their select options do too.
export const BUDGET_OPTIONS = [
	{ label: 'Under ₹2 lakh', value: 'under-2l' },
	{ label: '₹2–5 lakh', value: '2l-5l' },
	{ label: '₹5–15 lakh', value: '5l-15l' },
	{ label: 'Over ₹15 lakh', value: 'over-15l' },
];

export const TIMELINE_OPTIONS = [
	{ label: 'As soon as possible', value: 'asap' },
	{ label: 'In 1–3 months', value: '1-3-months' },
	{ label: 'Later this year', value: 'later' },
	{ label: 'Just exploring', value: 'exploring' },
];

/** Kept in step with the seeded `services` slugs; `?service=<slug>` preselects one. */
export const SERVICE_OPTIONS = [
	{ label: 'Brand identity', value: 'brand-identity' },
	{ label: 'Websites', value: 'websites' },
	{ label: 'Product design', value: 'product-design' },
	{ label: 'Photography', value: 'photography' },
];
