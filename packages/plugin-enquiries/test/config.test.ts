import { describe, expect, it } from 'vitest';
import { collection, defineConfig, fields as f } from '@kitcms/core';
import { sanitizeConfig } from '../../core/src/config/sanitize';
import { enquiries, type EnquiryForm } from '../src';

const form = (over: Partial<EnquiryForm> = {}): EnquiryForm => ({
	label: 'Contact',
	fields: { name: { type: 'text' }, email: { type: 'email' } },
	...over,
});
const make = (forms: Record<string, EnquiryForm>, extra = {}) => () => enquiries({ forms, ...extra });

describe('config validation', () => {
	it('rejects bad form names and empty forms', () => {
		expect(make({ 'Bad Name': form() })).toThrow(/form name/);
		expect(make({ '1x': form() })).toThrow(/form name/);
		expect(make({})).toThrow(/at least one form/);
		expect(make({ a: form({ fields: {} }) })).toThrow(/at least one field/);
	});
	it('replyTo must be an email field', () => {
		expect(make({ a: form({ replyTo: 'name' }) })).toThrow(/replyTo/);
		expect(make({ a: form({ replyTo: 'missing' }) })).toThrow(/replyTo/);
		expect(make({ a: form({ replyTo: 'email' }) })).not.toThrow();
	});
	it('select needs options', () => {
		expect(make({ a: form({ fields: { s: { type: 'select', options: [] } } }) })).toThrow(/option/);
		expect(make({ a: form({ fields: { s: { type: 'select', options: ['a', 'a'] } } }) })).toThrow(/unique/);
	});
	it('rejects reserved/invalid field names, bad notify and subject', () => {
		expect(make({ a: form({ fields: { _hp: { type: 'text' } } }) })).toThrow(/field name/);
		expect(make({ a: form({ fields: { 'a-b': { type: 'text' } } }) })).toThrow(/field name/);
		expect(make({ a: form({ notify: ['nope'] }) })).toThrow(/notify/);
		expect(make({ a: form({ subject: 'x\ny' }) })).toThrow(/single line/);
		expect(make({ a: form({ subject: '{field:zzz}' }) })).toThrow(/unknown field/);
	});
	it('rejects a bad rate limit and a colliding collection slug', () => {
		expect(make({ a: form() }, { rateLimit: { max: 0, window: 10 } })).toThrow(/rateLimit/);
		const cfg = defineConfig({
			collections: [collection({ slug: 'submissions', fields: { t: f.text() } })],
			plugins: [enquiries({ forms: { a: form() } })],
		} as never);
		expect(() => sanitizeConfig(cfg)).toThrow(/already exists/);
	});
	it('adds the locked-down collection, gated by the entitlement', () => {
		const c = sanitizeConfig(
			defineConfig({
				entitlements: { has: () => true },
				collections: [collection({ slug: 'pages', fields: { t: f.text() } })],
				plugins: [enquiries({ forms: { a: form() }, collection: 'inbox', entitlement: 'forms' })],
			} as never),
		);
		const col = c.collectionsBySlug.inbox!;
		expect(col.entitlement).toBe('forms');
		expect(c.plugins.find((p) => p.name === 'enquiries')!.entitlement).toBe('forms');
		expect(col.fields.map((x) => x.name)).toEqual(
			expect.arrayContaining(['form', 'data', 'page', 'status', 'email', 'name', 'notified']),
		);
	});
});
