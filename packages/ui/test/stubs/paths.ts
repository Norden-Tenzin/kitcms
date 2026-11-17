export const resolve = (route: string, params?: { path?: string }) =>
	route.replace('[...path]', params?.path ?? '').replace(/\/\(kitcms\)/, '');
