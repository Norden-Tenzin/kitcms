import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { EnquiryForm, fieldError } from '../src/svelte';

const children = createRawSnippet(() => ({ render: () => '<input name="email" />' }));

describe('EnquiryForm', () => {
	it('renders a post form with honeypot, page and live region', () => {
		const { body } = render(EnquiryForm, { props: { form: 'booking', page: '/contact', children } });
		expect(body).toContain('method="post"');
		expect(body).toContain('action="/api/plugins/enquiries/submit/booking"');
		expect(body).toContain('name="_hp"');
		expect(body).toContain('tabindex="-1"');
		expect(body).toContain('autocomplete="off"');
		expect(body).toContain('aria-hidden="true"');
		expect(body).toContain('name="_page" value="/contact"');
		expect(body).toContain('aria-live="polite"');
		expect(body).toContain('<input name="email" />');
		expect(body).not.toContain('data-enquiry-turnstile');
	});
	it('honours a custom action and renders the Turnstile mount point', () => {
		const { body } = render(EnquiryForm, {
			props: { form: 'booking', action: '/base/api/plugins/enquiries/submit/booking', turnstileSiteKey: 'k', children },
		});
		expect(body).toContain('action="/base/api/plugins/enquiries/submit/booking"');
		expect(body).toContain('data-enquiry-turnstile');
	});
	it('fieldError reads own keys only', () => {
		expect(fieldError({ errors: { a: 'bad' } }, 'a')).toBe('bad');
		expect(fieldError({ errors: {} }, 'toString')).toBeUndefined();
	});
});
