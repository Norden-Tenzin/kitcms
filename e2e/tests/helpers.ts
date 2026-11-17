import { type APIRequestContext, type Locator, type Page, type PlaywrightWorkerArgs, expect } from '@playwright/test';

let counter = 0;
const RUN = Date.now().toString(36);

/** A title that is unique per run and per call, so tests never collide with leftover data. */
export function uid(label: string): string {
	return `${label} ${RUN}${(counter++).toString(36)}`;
}

/** The document id from an edit URL like `/admin/collections/pages/<id>`. */
export function idFromUrl(url: string, collection: string): string {
	const m = new RegExp(`/collections/${collection}/([^/?#]+)`).exec(url);
	if (!m || m[1] === 'create') throw new Error(`no document id in ${url}`);
	return m[1]!;
}

/** The row of a list view containing `text`. */
export function row(page: Page, text: string): Locator {
	return page.locator('tbody tr', { hasText: text });
}

/** Waits for the page's hydration so enhanced forms and handlers are attached. */
export async function hydrated(page: Page): Promise<void> {
	await page.waitForLoadState('networkidle');
}

export { expect };

/** A valid 1x1 transparent PNG, so the admin can read its dimensions. */
export const PNG_1X1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==',
	'base64',
);

/** An API client with NO session (project `use.storageState` would otherwise be applied). */
export function anonymous(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string): Promise<APIRequestContext> {
	return playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
}
