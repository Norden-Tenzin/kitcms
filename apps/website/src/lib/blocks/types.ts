import type { DocOf, Rel } from '@kitcms/core';
import type config from '../../kitcms.config';

/**
 * Relationship/upload values are ids (`Rel`) or, after a `depth: 1` read, documents. The block
 * components accept both, so they are typed as `unknown` and narrowed with `../media.ts`.
 */
type Loose<T> =
	T extends Rel<string>
		? unknown
		: T extends readonly (infer E)[]
			? Loose<E>[]
			: T extends object
				? { [K in keyof T]: Loose<T[K]> }
				: T;

/** One block of a page's `sections`, by `blockType`. */
export type PageBlock = Loose<DocOf<typeof config, 'pages'>['sections'][number]>;

/**
 * The block's values. Partial because the same components render the admin live preview, where
 * values are incomplete while editing (and upload fields hold ids, see `../media.ts`).
 */
export type BlockOf<S extends PageBlock['blockType']> = Partial<
	Extract<PageBlock, { blockType: S }>
>;
