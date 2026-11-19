// Test harness: runs requests through core's plugin dispatch against a real Miniflare D1.
import type { RequestEvent } from '@sveltejs/kit';
import { vi } from 'vitest';
import { createTestDb, type TestDb } from '../../core/test/d1';
import { createLocalApi } from '../../core/src/api/local';
import { defineConfig, collection, fields as f } from '@kitcms/core';
import type { EmailMessageInput, KitcmsUser } from '@kitcms/core';
import { sanitizeConfig } from '../../core/src/config/sanitize';
import { createD1Adapter } from '../../core/src/db/d1';
import type { KitcmsInternals } from '../../core/src/sveltekit/index';
import { handlePluginEndpoint } from '../../core/src/sveltekit/plugins';
import { enquiries, type EnquiriesOptions } from '../src';

export const ORIGIN = 'https://site.test';
export const admin: KitcmsUser = { id: 'u1', email: 'a@x.io', name: 'A', role: 'admin', collection: 'users' };
export const editor: KitcmsUser = { id: 'u2', email: 'e@x.io', name: 'E', role: 'editor', collection: 'users' };

export const booking = {
	label: 'Booking',
	notify: ['front-desk@hotel.test'],
	subject: 'Booking from {field:name}',
	replyTo: 'email',
	fields: {
		name: { type: 'text', required: true, maxLength: 50 },
		email: { type: 'email', required: true },
		guests: { type: 'number', min: 1, max: 12, integer: true },
		arrival: { type: 'date' },
		room: { type: 'select', options: ['standard', { label: 'Suite', value: 'suite' }] },
		message: { type: 'textarea' },
		consent: { type: 'checkbox', required: true },
	},
} as const;

export interface Env {
	call(method: 'GET' | 'POST', path: string, o?: CallOpts, user?: KitcmsUser | null): Promise<Response>;
	cmsFor(user: KitcmsUser | null): ReturnType<typeof createLocalApi>;
	sent: EmailMessageInput[];
	email: { enabled: boolean; failWith: Error | null };
	dispose(): Promise<void>;
}
export interface CallOpts {
	origin?: string | null;
	body?: string;
	headers?: Record<string, string>;
}

let ipCounter = 0;

export async function setup(options?: Partial<EnquiriesOptions>): Promise<Env> {
	const config = sanitizeConfig(
		defineConfig({
			collections: [collection({ slug: 'pages', access: { read: () => true }, fields: { title: f.text() } })],
			plugins: [enquiries({ forms: { booking: booking as never }, ...options })],
		} as never),
	);
	const db: TestDb = await createTestDb(config);
	const adapter = createD1Adapter(config, db.d1);
	const cmsFor = (u: KitcmsUser | null, source: 'local' | 'admin' | 'rest' = 'local') =>
		createLocalApi({ config, db: adapter, user: u, source });
	const sent: EmailMessageInput[] = [];
	const email = { enabled: true, failWith: null as Error | null };
	const send = vi.fn(async (m: EmailMessageInput) => {
		if (email.failWith) throw email.failWith;
		sent.push(m);
		return { messageId: 'id' };
	});
	const internals = (user: KitcmsUser | null): KitcmsInternals => ({
		config,
		options: { config: {} as never },
		db: adapter,
		env: { DB: db.d1 },
		cms: cmsFor(user),
		user,
		cmsFor,
		email: { get enabled() { return email.enabled; }, send },
		runtime: () => ({ env: { DB: db.d1 }, cms: cmsFor(null) }),
	} as unknown as KitcmsInternals);

	return {
		sent,
		email,
		cmsFor: (u) => cmsFor(u),
		dispose: () => db.dispose(),
		async call(method, path, o = {}, user = null) {
			const url = new URL(`${ORIGIN}/api/plugins/enquiries/${path}`);
			const headers = new Headers(o.headers);
			if (!headers.has('cf-connecting-ip')) headers.set('cf-connecting-ip', `10.0.0.${++ipCounter}`);
			if (o.origin !== null && method !== 'GET') headers.set('origin', o.origin ?? ORIGIN);
			const init: RequestInit = { method, headers };
			if (o.body !== undefined) init.body = o.body;
			const event = {
				request: new Request(url, init),
				url,
				params: { path: `plugins/enquiries/${path}` },
				locals: {},
			} as unknown as RequestEvent;
			return handlePluginEndpoint(event, internals(user), method, ['enquiries', ...path.split('/').filter(Boolean)]);
		},
	};
}

export const json = (body: unknown, headers: Record<string, string> = {}): CallOpts => ({
	body: JSON.stringify(body),
	headers: { 'content-type': 'application/json', ...headers },
});
export const formPost = (body: Record<string, string>, headers: Record<string, string> = {}): CallOpts => ({
	body: new URLSearchParams(body).toString(),
	headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
});

export const validBooking = {
	name: 'Tashi <b>Dorje</b>',
	email: 'tashi@example.com',
	guests: 2,
	arrival: '2027-06-01',
	room: 'suite',
	message: 'Two nights.\r\nSubject: injected',
	consent: true,
};
