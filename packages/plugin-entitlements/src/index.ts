// @kitcms/plugin-entitlements (plan §17.2, Decision 34). Reads the plan from a Worker var set by the
// platform's control plane. There is deliberately no write path anywhere in this package.
export { entitlements } from './plugin';
export type { EntitlementsOptions } from './plugin';
export { parseEntitlements } from './parse';
export type { Entitlements, EntitlementLimits } from './parse';
