// Decision 36: a function-valued `email.from` / `email.replyTo`, and `admin.title`.
import { describe, expect, it, vi } from 'vitest';
import { defineConfig } from '../config/collection';
import { sanitizeConfig, toClientConfig } from '../config/sanitize';
import type { Cms } from '../api/types';
import { emailFor, EmailNotConfiguredError, resolveEmailSettings } from './index';

const ctx = { env: { EMAIL_FROM: 'noreply@mail.example.com' }, cms: {} as Cms };

describe('sanitize', () => {
	it('accepts functions for email.from, email.replyTo and admin.title', () => {
		const from = () => ({ address: 'a@b.co' });
		const replyTo = () => 'r@b.co';
		const title = () => 'Hotel';
		const c = sanitizeConfig(defineConfig({ collections: [], email: { from, replyTo }, admin: { title } }));
		expect(c.email).toEqual({ from, replyTo });
		expect(c.admin.title).toBe(title);
		// The browser never receives a function.
		expect(toClientConfig(c).admin.title).toBe('kitcms');
	});

	it('still validates static values', () => {
		expect(() => sanitizeConfig(defineConfig({ collections: [], email: { from: { address: 'nope' } } }))).toThrow(
			/email\.from\.address/,
		);
		expect(() =>
			sanitizeConfig(defineConfig({ collections: [], email: { from: () => ({ address: 'a@b.co' }), replyTo: 'bad' } })),
		).toThrow(/email\.replyTo/);
		expect(() => sanitizeConfig(defineConfig({ collections: [], admin: { title: 3 as never } }))).toThrow(/admin\.title/);
	});
});

describe('resolveEmailSettings', () => {
	it('resolves the sender from the runtime context and cleans the name', async () => {
		const r = await resolveEmailSettings(
			{
				from: ({ env }) => ({ address: String(env.EMAIL_FROM), name: ' Hotel\r\n"Snow" <view> ' }),
				replyTo: async () => 'desk@hotel.test',
			},
			ctx,
		);
		expect(r).toEqual({ from: { address: 'noreply@mail.example.com', name: 'Hotel Snow view' }, replyTo: 'desk@hotel.test' });
	});

	it('drops an empty name and an invalid reply-to; rejects an invalid sender', async () => {
		expect(await resolveEmailSettings({ from: () => ({ address: 'a@b.co', name: ' <> ' }), replyTo: () => 'not mail' }, ctx)).toEqual({
			from: { address: 'a@b.co' },
		});
		await expect(resolveEmailSettings({ from: () => ({ address: 'x\r\nBcc: y@z.co' }) }, ctx)).rejects.toBeInstanceOf(
			EmailNotConfiguredError,
		);
	});
});

describe('emailFor', () => {
	it('sends with the resolved sender and reply-to', async () => {
		const send = vi.fn(async () => ({ messageId: 'm1' }));
		const config = sanitizeConfig(
			defineConfig({
				collections: [],
				email: { from: ({ env }) => ({ address: String(env.EMAIL_FROM), name: 'Hotel' }), replyTo: () => 'desk@hotel.test' },
			}),
		);
		const sender = emailFor(config, { ...ctx.env, EMAIL: { send } }, false, () => ctx.cms);
		await sender.send({ to: 'guest@x.co', subject: 'Hi', text: 'Hello' });
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				from: { email: 'noreply@mail.example.com', name: 'Hotel' },
				replyTo: 'desk@hotel.test',
				to: 'guest@x.co',
			}),
		);
	});

	it('a message reply-to still wins over the default', async () => {
		const send = vi.fn(async () => ({ messageId: null }));
		const config = sanitizeConfig(
			defineConfig({ collections: [], email: { from: () => ({ address: 'a@b.co' }), replyTo: () => 'desk@hotel.test' } }),
		);
		await emailFor(config, { EMAIL: { send } }, false, () => ctx.cms).send({ to: 'g@x.co', subject: 'S', text: 'T', replyTo: 'guest@x.co' });
		expect(send).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'guest@x.co' }));
	});
});
