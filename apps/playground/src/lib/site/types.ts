// Types for what the site reads from the CMS. Relationship and upload values are ids or, after a
// `depth: 1` read, documents, so the site types them as `unknown` and narrows with `media.ts`.
import type { DocOf, GlobalDocOf, Rel } from '@kitcms/core';
import type config from '../../kitcms.config';

type Loose<T> =
	T extends Rel<string>
		? unknown
		: T extends readonly (infer E)[]
			? Loose<E>[]
			: T extends object
				? { [K in keyof T]: Loose<T[K]> }
				: T;

export type Page = Loose<DocOf<typeof config, 'pages'>>;
/** One block of a page's `sections`, by `blockType`. */
export type PageBlock = Page['sections'][number];
export type BlockType = PageBlock['blockType'];
/** A block's values. Partial: the admin live preview renders blocks while they are incomplete. */
export type BlockOf<S extends BlockType> = Partial<Extract<PageBlock, { blockType: S }>>;

export type Site = Loose<GlobalDocOf<typeof config, 'site'>>;
export type Service = Loose<DocOf<typeof config, 'services'>>;
export type Project = Loose<DocOf<typeof config, 'projects'>>;
export type Testimonial = Loose<DocOf<typeof config, 'testimonials'>>;
export type TeamMember = Loose<DocOf<typeof config, 'team'>>;
export type Post = Loose<DocOf<typeof config, 'posts'>>;
export type Offer = Loose<DocOf<typeof config, 'offers'>>;
export type Tag = Loose<DocOf<typeof config, 'tags'>>;

/**
 * Collection data some blocks render. Loaded server-side by `content.ts#loadBlockExtras` (only what a
 * page's block types need) and passed to `RenderBlocks`. Absent in the admin preview, where the
 * blocks show a labelled placeholder instead.
 */
export interface BlockExtras {
	services?: Service[];
	projects?: Project[];
	testimonials?: Testimonial[];
	team?: TeamMember[];
	posts?: Post[];
	/** `null`: the `offers` add-on is off (the block renders nothing). */
	offers?: Offer[] | null;
}
