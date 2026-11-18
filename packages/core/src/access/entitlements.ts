// Entitlement checks (Decision 34, plan §17.2). SECURITY-CRITICAL: changes need Opus review + tests.
//
// FAIL CLOSED: a gated item is on only when the provider answers exactly `true`. A provider that
// throws, returns anything else, or is missing (impossible after sanitizing, still handled) = off.
import type { SanitizedConfig } from '../config/sanitized';

/** Is `addon` on? No addon (ungated) → always `true`. */
export async function entitled(
	config: Pick<SanitizedConfig, 'entitlements'>,
	addon: string | undefined,
): Promise<boolean> {
	if (addon === undefined) return true;
	const provider = config.entitlements;
	if (!provider) return false;
	try {
		return (await provider.has(addon)) === true;
	} catch {
		return false;
	}
}

/** The items whose `entitlement` is on (ungated items always), in order. */
export async function filterEntitled<T extends { entitlement?: string }>(
	config: Pick<SanitizedConfig, 'entitlements'>,
	items: readonly T[],
): Promise<T[]> {
	const ok = await Promise.all(items.map((i) => entitled(config, i.entitlement)));
	return items.filter((_, i) => ok[i]);
}

// The provider of each gated collection/global, bound at sanitize time. A WeakMap (not a property)
// so the sanitized object stays serializable and nothing outside core can swap the provider.
const providers = new WeakMap<object, NonNullable<SanitizedConfig['entitlements']>>();

/** @internal Called by `sanitizeConfig` for every gated collection and global. */
export function bindEntitlements(
	collection: object,
	provider: NonNullable<SanitizedConfig['entitlements']>,
): void {
	providers.set(collection, provider);
}

/** Is this collection/global on? Ungated → `true`; gated without a bound provider → `false`. */
export function collectionEntitled(collection: { entitlement?: string }): Promise<boolean> {
	return entitled({ entitlements: providers.get(collection) }, collection.entitlement);
}
