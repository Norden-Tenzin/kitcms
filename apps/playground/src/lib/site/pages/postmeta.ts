// Small readers for a journal post's relationships (populated documents or bare ids).
import { asDoc, asMedia } from '../media';
import type { Post } from '../types';

export interface PostAuthor {
	id: string;
	name: string;
	role?: string | null;
	photo?: unknown;
	bio?: string | null;
}
export interface PostTag {
	id: string;
	name: string;
	slug: string;
}

export const authorOf = (p: Pick<Post, 'author'>) => asDoc<PostAuthor>(p.author);
export const tagsOf = (p: Pick<Post, 'tags'>): PostTag[] =>
	(Array.isArray(p.tags) ? p.tags : []).map((t) => asDoc<PostTag>(t)).filter((t): t is PostTag => t !== null);
export const photoOf = (a: PostAuthor | null) => asMedia(a?.photo);
