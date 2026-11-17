// @kitcms/core: config, fields, types and the Local API.
export { fields } from './config/fields';
export { block, collection, defineConfig } from './config/collection';

export type * from './config/fields';
export type * from './config/collection';
export type * from './config/hooks';
export type { Rel, RichTextDoc, RichTextNode, InferFields, InferInput, Simplify } from './config/infer';
export type { Where, WhereOps, WhereInput, Sort } from './config/where';
export type {
	Cms,
	Depth,
	FindArgs,
	LocalAPI,
	OperationOptions,
	PaginatedDocs,
	Populate,
	ReadOptions,
} from './api/types';
export type { DocOf, InputOf } from './api/types';
