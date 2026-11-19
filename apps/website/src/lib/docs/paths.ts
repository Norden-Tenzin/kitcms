// Every docs URL, from the file names in `src/docs/` (a virtual module filled at build time by
// `build/docs.ts`; no Markdown reaches the Worker). Feeds the sitemap in `kitcms.config.ts`.
import paths from 'virtual:kitcms-docs-paths';

export const docsPaths: string[] = paths;
