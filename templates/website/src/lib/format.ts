/** A date for display. UTC, so the server and the browser agree (no hydration mismatch). */
export const formatDate = (iso?: string | null, dateStyle: 'medium' | 'long' = 'medium') =>
	iso ? new Date(iso).toLocaleDateString('en', { dateStyle, timeZone: 'UTC' }) : '';
