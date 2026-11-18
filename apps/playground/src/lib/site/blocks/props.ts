import type { DesignId } from '../designs';
import type { BlockExtras, BlockOf, PageBlock } from '../types';

/** Every block component takes the block's values, the resolved design and the data it renders. */
export interface BlockProps<S extends PageBlock['blockType']> {
	block: BlockOf<S>;
	design?: DesignId;
	extras?: BlockExtras;
	/** The first block of the page: its picture is the LCP image (eager, not lazy). */
	first?: boolean;
}
