// THE LIVE PREVIEW CONTRACT (plan §13.5, Decision 23).
//
// Preview components are browser code; the kitcms config is server code. So previews are
// registered in a client-safe file, `src/kitcms.admin.ts`, and handed to `<Admin admin={...}>`
// by the generated `+page.svelte`:
//
//   // src/kitcms.admin.ts
//   import { defineAdmin } from '@kitcms/ui';
//   export default defineAdmin({
//     previews: {
//       collections: { pages: () => import('#lib/previews/Page.svelte') },
//       globals: { site: () => import('#lib/previews/Site.svelte') },
//       blocks: { hero: () => import('#lib/blocks/Hero.svelte') },
//     },
//   });
//
// Components are loaded lazily (dynamic import), only on edit views that need them.
//
// Props:
// - collection/global preview: `{ doc }`, the LIVE form state of the document (a Svelte `$state`
//   object: it updates on every keystroke, with no delay). Read-only by contract: never write it.
// - block preview: `{ block, doc }`: the block's live values (with `id` and `blockType`) and the
//   whole document's live values.
// Relationship/upload values are ids. Resolve them with `useRelation(collection, () => id)`.
//
// The edit view shows the preview pane when the collection/global has a preview, or when any
// `blocks` field of the document has a block with a preview (a default preview then renders the
// blocks in order, using each block's component, and a labelled placeholder for the others).
// Previews render in the admin DOM inside `.kitcms-preview` (no iframe), with a desktop/mobile
// width toggle (100% / 390px). Site CSS that previews need must be imported by the preview
// components themselves and should be scoped (Svelte component styles are).

import type { Component } from 'svelte';
import type { CollectionSlug, GlobalSlug, RegisteredConfig } from '@kitcms/core';

/** A lazily imported Svelte component (`() => import('./X.svelte')`). */
export type LazyComponent<Props extends Record<string, unknown>> = () => Promise<{
	default: Component<Props>;
}>;

/** Live form values of a document (partial while editing). */
export type PreviewDoc = Record<string, unknown>;

export interface DocPreviewProps {
	/** The live form state. Read-only. */
	doc: PreviewDoc;
	[key: string]: unknown;
}

export interface BlockPreviewProps {
	/** The block's live values: `{ id, blockType, ...fields }`. Read-only. */
	block: PreviewDoc & { id?: string; blockType: string };
	/** The whole document's live values. Read-only. */
	doc: PreviewDoc;
	[key: string]: unknown;
}

type Slugs<S> = string extends S ? string : S & string;

export interface AdminPreviews {
	collections?: Partial<Record<Slugs<CollectionSlug<RegisteredConfig>>, LazyComponent<DocPreviewProps>>>;
	globals?: Partial<Record<Slugs<GlobalSlug<RegisteredConfig>>, LazyComponent<DocPreviewProps>>>;
	/** By block slug (shared by every `blocks` field that uses the block). */
	blocks?: Record<string, LazyComponent<BlockPreviewProps>>;
}

/** Client-side admin options. Everything here is shipped to the browser. */
export interface AdminClientConfig {
	previews?: AdminPreviews;
}

/** Declares the client-side admin options in `src/kitcms.admin.ts` (identity at runtime). */
export function defineAdmin(config: AdminClientConfig): AdminClientConfig {
	return config;
}
