// Pure parsing of the entitlements JSON. Strict and fail-closed: anything malformed yields the
// "unknown" plan with no add-ons and no limits, so gated features stay off and ungated ones keep working.

export interface EntitlementLimits {
	/** Max documents per collection slug. */
	documents: Record<string, number>;
	/** Max size of one uploaded file in bytes, or `null` for no limit. */
	uploadBytes: number | null;
}

export interface Entitlements {
	plan: string;
	addons: string[];
	limits: EntitlementLimits;
	/** `false` when the value was missing or malformed (everything gated is off). */
	valid: boolean;
}

const ADDON = /^[a-z][a-z0-9_-]{0,63}$/;
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

const invalid = (): Entitlements => ({
	plan: 'unknown',
	addons: [],
	limits: { documents: {}, uploadBytes: null },
	valid: false,
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

const isLimit = (v: unknown): v is number =>
	typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/**
 * Parses the raw variable value (a JSON string or an already-parsed object).
 * Strict: ONE bad add-on name, limit or field makes the whole value invalid (a half-trusted
 * payload is not trusted at all), so a typo can never silently turn something on.
 */
export function parseEntitlements(raw: unknown): Entitlements {
	let value = raw;
	if (typeof raw === 'string') {
		try {
			value = JSON.parse(raw);
		} catch {
			return invalid();
		}
	}
	if (!isRecord(value)) return invalid();

	const { plan, addons, limits } = value;
	if (typeof plan !== 'string' || plan.trim() === '' || plan.length > 64) return invalid();
	if (!Array.isArray(addons) || addons.length > 256) return invalid();
	const names: string[] = [];
	for (const a of addons) {
		if (typeof a !== 'string' || !ADDON.test(a)) return invalid();
		if (!names.includes(a)) names.push(a);
	}

	const out: EntitlementLimits = { documents: {}, uploadBytes: null };
	if (limits !== undefined) {
		if (!isRecord(limits)) return invalid();
		const { documents, uploadBytes } = limits;
		if (documents !== undefined) {
			if (!isRecord(documents)) return invalid();
			for (const [slug, n] of Object.entries(documents)) {
				if (!SLUG.test(slug) || !isLimit(n)) return invalid();
				out.documents[slug] = n;
			}
		}
		if (uploadBytes !== undefined && uploadBytes !== null) {
			if (!isLimit(uploadBytes)) return invalid();
			out.uploadBytes = uploadBytes;
		}
	}
	return { plan, addons: names, limits: out, valid: true };
}
