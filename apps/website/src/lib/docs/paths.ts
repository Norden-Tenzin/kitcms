// Every docs URL, from the file names in `src/docs/`. `build/docs.ts` keeps the generated file in
// step (no Markdown reaches the Worker). Feeds the sitemap in `kitcms.config.ts`; a plain module so
// the `kitcms` CLI can load the config without Vite plugins.
import paths from './paths.generated.ts';

export const docsPaths: string[] = paths;
