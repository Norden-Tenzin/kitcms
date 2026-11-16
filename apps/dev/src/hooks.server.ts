import { kitcms } from '@kitcms/core/sveltekit';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { createSpikeCms } from '#lib/server/spike-cms.ts';
import { sharedState } from '#lib/shared-state.ts';

const countRequests: Handle = ({ event, resolve }) => {
	sharedState.requests++;
	return resolve(event);
};

export const handle = sequence(kitcms({ create: createSpikeCms }).handle, countRequests);
