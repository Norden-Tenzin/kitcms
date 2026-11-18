import type { CollectionSlug, DocOf, GlobalDocOf, Rel } from '@kitcms/core';
import type config from '../../kitcms.config';

/**
 * Relationship/upload values are ids (`Rel`) or, after a `depth: 1` read, documents. Site components
 * accept both, so they are typed as `unknown` and narrowed with `./media.ts`.
 */
type Loose<T> =
	T extends Rel<string>
		? unknown
		: T extends readonly (infer E)[]
			? Loose<E>[]
			: T extends object
				? { [K in keyof T]: Loose<T[K]> }
				: T;

type Doc<S extends CollectionSlug<typeof config>> = Loose<DocOf<typeof config, S>>;

export type Page = Doc<'pages'>;
export type Room = Doc<'rooms'>;
export type Experience = Doc<'experiences'>;
export type Post = Doc<'posts'>;
export type Tag = Doc<'tags'>;
export type Album = Doc<'albums'>;
export type Testimonial = Doc<'testimonials'>;
export type Faq = Doc<'faqs'>;
export type Offer = Doc<'offers'>;
export type Dish = Doc<'dishes'>;
export type TeamMember = Doc<'team'>;
export type Legal = Doc<'legal'>;
export type Site = Loose<GlobalDocOf<typeof config, 'site'>>;

/** One block of a page's `sections`, by `blockType`. */
export type PageBlock = Page['sections'][number];

/**
 * The block's values. Partial because the same components render the admin live preview, where
 * values are incomplete while editing (and upload fields hold ids, see `./media.ts`).
 */
export type BlockOf<S extends PageBlock['blockType']> = Partial<Extract<PageBlock, { blockType: S }>>;

/** Collection data some blocks render (loaded by `content.ts`). Absent in the admin preview. */
export interface BlockExtras {
	rooms?: Room[];
	experiences?: Experience[];
	testimonials?: Testimonial[];
	faqs?: Faq[];
	offers?: Offer[];
	albums?: Album[];
	site?: Site;
}
