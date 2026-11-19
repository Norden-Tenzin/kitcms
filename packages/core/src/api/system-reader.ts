// The Local API handed to resolvable config values (Decision 36) and other trusted read-only code:
// every READ runs as the system (`overrideAccess: true`), and every write throws, so a value computed
// from the site's content can never change it.
import type { Cms } from './types';

/** Index of the options argument of each read method. */
const READS: Record<string, number> = {
	find: 1,
	findOne: 1,
	count: 1,
	findByID: 2,
	findGlobal: 1,
};

export function systemReader(cms: Cms): Cms {
	return new Proxy(cms, {
		get(target, prop, receiver) {
			const value: unknown = Reflect.get(target, prop, receiver);
			if (typeof value !== 'function') return value;
			const at = typeof prop === 'string' ? READS[prop] : undefined;
			if (at === undefined) {
				return () => {
					throw new Error(`kitcms: cms.${String(prop)} is not available here (read-only system access).`);
				};
			}
			return (...args: unknown[]) => {
				while (args.length <= at) args.push(undefined);
				const options = args[at];
				args[at] = { ...(typeof options === 'object' && options !== null ? options : {}), overrideAccess: true };
				return (value as (...a: unknown[]) => unknown).apply(target, args);
			};
		},
	});
}
