// Dev only: `?design=a|b|c` previews one design of a page type without saving settings (screenshots,
// design review). `dev` is false in the production build, so the parameter is ignored there.
import { dev } from '$app/env';

export const devPick = (url: URL): string | null => (dev ? url.searchParams.get('design') : null);
