<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { EnquiryState } from './types';

	let {
		form,
		action,
		turnstileSiteKey,
		page,
		class: className,
		children,
	}: {
		/** The form name from the plugin config. */
		form: string;
		/** Submit URL. Default `/api/plugins/enquiries/submit/<form>`; pass a base-prefixed URL if the app has a base path. */
		action?: string;
		/** Turn on the Cloudflare Turnstile widget (must match the plugin's `turnstile.siteKey`). */
		turnstileSiteKey?: string;
		/** The current page path, used to redirect back (no-JS) and stored with the submission. */
		page?: string;
		class?: string;
		children: Snippet<[EnquiryState]>;
	} = $props();

	let status = $state<EnquiryState['status']>('idle');
	let message = $state('');
	let errors = $state<Record<string, string>>({});
	let formEl: HTMLFormElement | undefined = $state();
	let widgetEl: HTMLDivElement | undefined = $state();
	let widgetId: string | undefined;

	const url = $derived(action ?? `/api/plugins/enquiries/submit/${encodeURIComponent(form)}`);

	const enquiry: EnquiryState = {
		get status() {
			return status;
		},
		get message() {
			return message;
		},
		get errors() {
			return errors;
		},
		reset() {
			status = 'idle';
			message = '';
			errors = {};
		},
	};

	interface TurnstileApi {
		render(el: HTMLElement, opts: { sitekey: string }): string;
		reset(id?: string): void;
		remove(id?: string): void;
	}
	const turnstile = (): TurnstileApi | undefined =>
		(globalThis as unknown as { turnstile?: TurnstileApi }).turnstile;

	const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
	let scriptPromise: Promise<void> | undefined;
	function loadTurnstile(): Promise<void> {
		if (turnstile()) return Promise.resolve();
		scriptPromise ??= new Promise<void>((resolve, reject) => {
			let s: HTMLScriptElement | null = document.querySelector('script[data-kitcms-turnstile]');
			if (!s) {
				s = document.createElement('script');
				s.src = SCRIPT;
				s.async = true;
				s.dataset.kitcmsTurnstile = '';
				document.head.appendChild(s);
			}
			s.addEventListener('load', () => resolve());
			s.addEventListener('error', () => {
				scriptPromise = undefined;
				reject(new Error('Turnstile failed to load'));
			});
		});
		return scriptPromise;
	}

	$effect(() => {
		const key = turnstileSiteKey;
		const el = widgetEl;
		if (!key || !el) return;
		let cancelled = false;
		loadTurnstile()
			.then(() => {
				if (cancelled) return;
				widgetId = turnstile()?.render(el, { sitekey: key });
			})
			.catch(() => {
				if (!cancelled) {
					status = 'error';
					message = 'The spam check could not be loaded. Reload the page and try again.';
				}
			});
		return () => {
			cancelled = true;
			if (widgetId !== undefined) turnstile()?.remove(widgetId);
			widgetId = undefined;
		};
	});

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		if (status === 'submitting' || !formEl) return;
		status = 'submitting';
		message = '';
		errors = {};
		try {
			const data = new FormData(formEl);
			if (!data.get('_page')) data.set('_page', page || location.pathname + location.search);
			const res = await fetch(url, { method: 'POST', body: data, headers: { accept: 'application/json' } });
			let json: { message?: string; error?: string; errors?: { path: string; message: string }[] } = {};
			try {
				json = await res.json();
			} catch {
				/* not JSON */
			}
			if (res.ok) {
				status = 'success';
				message = json.message ?? 'Thank you. Your message has been sent.';
				formEl.reset();
			} else {
				status = 'error';
				message = json.error ?? 'Something went wrong. Please try again.';
				const next: Record<string, string> = {};
				for (const e of json.errors ?? []) if (e.path && !(e.path in next)) next[e.path] = e.message;
				errors = next;
			}
		} catch {
			status = 'error';
			message = 'Network error. Please try again.';
		}
		if (widgetId !== undefined) turnstile()?.reset(widgetId);
	}
</script>

<form bind:this={formEl} method="post" action={url} class={className} {onsubmit}>
	<input type="hidden" name="_page" value={page ?? ''} />
	<div
		aria-hidden="true"
		style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden"
	>
		<label>Leave this field empty <input type="text" name="_hp" tabindex="-1" autocomplete="off" value="" /></label>
	</div>
	{@render children(enquiry)}
	{#if turnstileSiteKey}<div bind:this={widgetEl} data-enquiry-turnstile></div>{/if}
	<div role="status" aria-live="polite" data-enquiry-status={status}>{message}</div>
</form>
