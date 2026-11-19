// `admin.title`, resolved for a request (Decision 36). Used by the admin pages and in emails.
import { resolveValue } from '../config/resolvable';
import type { KitcmsInternals } from './index';

/** A failing or empty function shows `'kitcms'`. */
export async function adminTitle(k: KitcmsInternals): Promise<string> {
	const raw = k.config.admin.title;
	if (typeof raw === 'string') return raw;
	try {
		const value = await resolveValue(raw, k.runtime());
		return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : 'kitcms';
	} catch (err) {
		console.error('kitcms: admin.title failed', err);
		return 'kitcms';
	}
}
