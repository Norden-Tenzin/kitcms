import type { Handle } from '@sveltejs/kit/hooks';
import { sharedState } from '#lib/shared-state.ts';

export const handle: Handle = ({ event, resolve }) => {
	sharedState.requests++;
	return resolve(event);
};
