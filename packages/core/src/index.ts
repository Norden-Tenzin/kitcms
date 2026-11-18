// @kitcms/core: config, fields, types and the Local API.
export { fields } from './config/fields';
export { block, collection, defineConfig, global } from './config/collection';
export { defineSeed } from './seed';
export type { SeedContext, SeedFn } from './seed';

export type * from './config/fields';
export type * from './config/collection';
export type * from './config/hooks';
export type * from './config/plugin';
export type {
	Rel,
	RichTextDoc,
	RichTextNode,
	InferFields,
	InferInput,
	Simplify,
} from './config/infer';
export type { Where, WhereOps, WhereInput, Sort } from './config/where';
export type {
	Cms,
	Depth,
	DraftReadOption,
	DraftWriteOption,
	FindVersionsArgs,
	GlobalDocOf,
	GlobalInputOf,
	MoveTarget,
	VersionDoc,
	WriteOptions,
	FindArgs,
	LocalAPI,
	OperationOptions,
	PaginatedDocs,
	Populate,
	ReadOptions,
} from './api/types';
export type { DocOf, InputOf } from './api/types';
// Errors (Decision 33): plugins throw these so the admin, REST, RPC and plugin endpoints map them.
export {
	ConfigError,
	ForbiddenError,
	isKitcmsError,
	KitcmsError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from './errors';
export type { FieldError, KitcmsErrorCode } from './errors';
