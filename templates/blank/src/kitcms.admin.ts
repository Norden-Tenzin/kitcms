// Client-side admin options (shipped to the browser, so keep server-only code out of here).
// Live preview components are registered here and loaded lazily. Example:
//
//   previews: {
//     collections: { pages: () => import('#lib/previews/Page.svelte') },   // { doc }
//     globals: { site: () => import('#lib/previews/Site.svelte') },        // { doc }
//     blocks: { hero: () => import('#lib/blocks/Hero.svelte') },           // { block, doc }
//   },
//
// `doc` and `block` are the live form values: read-only, never write to them. Resolve
// upload/relationship ids with `useRelation(collection, () => id)` from '@kitcms/ui'.
import { defineAdmin } from '@kitcms/ui';

export default defineAdmin({});
