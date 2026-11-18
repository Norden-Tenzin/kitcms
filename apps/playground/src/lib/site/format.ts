/** "21 Oct 2026" from an ISO date string (UTC, so a server and a browser agree). */
export function formatDate(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Initials for a person without a photo ("Isha Rao" -> "IR"). */
export function initials(name: string | null | undefined): string {
	return (name ?? '')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase())
		.join('');
}
