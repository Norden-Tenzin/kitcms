import { kitcms } from '@kitcms/core/sveltekit';
import config from './kitcms.config';

export const handle = kitcms({ config }).handle;
