// Small presentation helpers shared by every design.
export const inr = (n: number | null | undefined) => (n || n === 0 ? `₹${n.toLocaleString('en-IN')}` : '');

export const VIEW_LABELS: Record<string, string> = {
	orchard: 'Orchard',
	mountain: 'Mountains',
	stupa: 'Shanti Stupa',
	courtyard: 'Courtyard',
};
export const viewLabel = (v: string | null | undefined) => (v ? (VIEW_LABELS[v] ?? v) : '');

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) =>
	iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts }) : '';

/** "26 m², sleeps 2, 1 king bed" style one-liner. */
export function roomFacts(r: { sizeSqm?: number | null; maxGuests?: number | null; beds?: string | null }) {
	return [
		r.sizeSqm ? `${r.sizeSqm} m²` : '',
		r.maxGuests ? `sleeps ${r.maxGuests}` : '',
		r.beds ?? '',
	].filter(Boolean);
}

export const DIFFICULTY_LABELS: Record<string, string> = { easy: 'Easy', moderate: 'Moderate', hard: 'Demanding' };
