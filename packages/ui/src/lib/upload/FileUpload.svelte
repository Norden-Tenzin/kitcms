<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ClientCollection } from '@kitcms/core/client';

	interface Props {
		/** Only `slug` and `upload` are used, so the media picker can pass just a slug + options. */
		collection: Pick<ClientCollection, 'slug' | 'upload'>;
		/** Edit mode: the stored document (uploading replaces its file). */
		doc?: Record<string, unknown>;
		onuploaded?: (doc: Record<string, unknown>) => void;
		/** Show the last uploaded/current file above the drop zone (default true; off in the media library and picker). */
		showCurrent?: boolean;
	}
	let { collection, doc, onuploaded, showCurrent = true }: Props = $props();

	let current = $state<Record<string, unknown> | undefined>(undefined);
	const shown = $derived(current ?? doc);
	let over = $state(false);
	let progress = $state<number | null>(null);
	let error = $state('');
	let input: HTMLInputElement | undefined = $state();

	const rules = $derived(collection.upload || null);
	const accept = $derived(rules && rules.mimeTypes.length ? rules.mimeTypes.join(',') : undefined);

	function formatSize(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / 1024 / 1024).toFixed(1)} MB`;
	}

	function mimeOk(type: string): boolean {
		if (!rules || rules.mimeTypes.length === 0) return true;
		return rules.mimeTypes.some((m) => (m.endsWith('/*') ? type.startsWith(m.slice(0, -1)) : type === m));
	}

	function check(file: File): string | null {
		if (!rules) return `"${collection.slug}" does not accept uploads.`;
		if (file.size === 0) return 'The file is empty.';
		if (file.size > rules.maxFileSize) {
			return `The file is ${formatSize(file.size)}; the limit is ${formatSize(rules.maxFileSize)}.`;
		}
		if (!mimeOk(file.type)) {
			return `${file.type || 'This file type'} is not allowed. Allowed: ${rules.mimeTypes.join(', ')}.`;
		}
		return null;
	}

	async function dimensions(file: File): Promise<{ width: number; height: number } | null> {
		if (!file.type.startsWith('image/')) return null;
		try {
			const bmp = await createImageBitmap(file);
			const out = { width: bmp.width, height: bmp.height };
			bmp.close();
			return out;
		} catch {
			return null;
		}
	}

	async function upload(file: File) {
		error = '';
		const problem = check(file);
		if (problem) {
			error = problem;
			return;
		}
		const form = new FormData();
		form.set('file', file);
		if (doc?.id) form.set('id', String(doc.id));
		const dims = await dimensions(file);
		if (dims) {
			form.set('width', String(dims.width));
			form.set('height', String(dims.height));
		}
		const url = resolve('/(kitcms)/api/[...path]', { path: `upload/${collection.slug}` });
		progress = 0;
		const xhr = new XMLHttpRequest();
		xhr.open('POST', url);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) progress = Math.round((e.loaded / e.total) * 100);
		};
		xhr.onerror = () => {
			progress = null;
			error = 'The upload failed. Check your connection and try again.';
		};
		xhr.onload = () => {
			progress = null;
			let body: Record<string, unknown> = {};
			try {
				body = JSON.parse(xhr.responseText) as Record<string, unknown>;
			} catch {
				/* not JSON */
			}
			if (xhr.status >= 200 && xhr.status < 300) {
				const saved = (body.doc as Record<string, unknown> | undefined) ?? body;
				current = saved;
				onuploaded?.(saved);
			} else {
				error = typeof body.error === 'string' ? body.error : `The upload failed (${xhr.status}).`;
			}
		};
		xhr.send(form);
	}

	function pick(files: FileList | null | undefined) {
		const file = files?.[0];
		if (file) void upload(file);
		if (input) input.value = '';
	}

	const busy = $derived(progress !== null);
</script>

<div class="kc-upload">
	{#if showCurrent && shown && typeof shown.filename === 'string'}
		<div class="kc-upload__current">
			{#if typeof shown.mimeType === 'string' && shown.mimeType.startsWith('image/') && typeof shown.url === 'string'}
				<img class="kc-upload__preview" src={shown.url} alt={typeof shown.alt === 'string' ? shown.alt : ''} />
			{/if}
			<div>
				<div class="kc-upload__name">{shown.filename}</div>
				<div class="kc-upload__meta">
					{shown.mimeType ?? ''}{typeof shown.filesize === 'number' ? ` · ${formatSize(shown.filesize)}` : ''}{typeof shown.width === 'number' && typeof shown.height === 'number' ? ` · ${shown.width}×${shown.height}` : ''}
				</div>
			</div>
		</div>
	{/if}

	<div
		class="kc-upload__zone"
		class:kc-upload__zone--over={over}
		role="group"
		aria-label="File upload"
		ondragover={(e) => {
			e.preventDefault();
			over = true;
		}}
		ondragleave={() => (over = false)}
		ondrop={(e) => {
			e.preventDefault();
			over = false;
			if (!busy) pick(e.dataTransfer?.files);
		}}
	>
		<span>Drop a file here or</span>
		<button type="button" class="kc-btn" disabled={busy} onclick={() => input?.click()}>
			{shown?.filename ? 'Replace file' : 'Choose file'}
		</button>
		<input bind:this={input} type="file" {accept} hidden onchange={(e) => pick(e.currentTarget.files)} />
		{#if rules && Number.isFinite(rules.maxFileSize)}
			<small class="kc-upload__hint">
				Max {formatSize(rules.maxFileSize)}{rules.mimeTypes.length ? ` · ${rules.mimeTypes.join(', ')}` : ''}
			</small>
		{/if}
	</div>

	{#if progress !== null}
		<progress class="kc-upload__progress" max="100" value={progress}>{progress}%</progress>
	{/if}
	{#if error}
		<p class="kc-upload__error" role="alert">{error}</p>
	{/if}
</div>

<style>
	.kc-upload {
		display: grid;
		gap: 0.75rem;
	}
	.kc-upload__current {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	.kc-upload__preview {
		max-width: 8rem;
		max-height: 8rem;
		object-fit: contain;
		border: 1px solid var(--kc-border);
		border-radius: var(--kc-radius);
		background: var(--kc-surface);
	}
	.kc-upload__name {
		font-weight: 600;
		word-break: break-all;
	}
	.kc-upload__meta,
	.kc-upload__hint {
		color: var(--kc-muted);
		font-size: 0.85rem;
	}
	.kc-upload__zone {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 1.25rem;
		border: 2px dashed var(--kc-border);
		border-radius: var(--kc-radius);
		color: var(--kc-muted);
	}
	.kc-upload__zone--over {
		border-color: var(--kc-accent);
		background: color-mix(in srgb, var(--kc-accent) 8%, transparent);
	}
	.kc-upload__progress {
		width: 100%;
		accent-color: var(--kc-accent);
	}
	.kc-upload__error {
		margin: 0;
		color: var(--kc-danger);
	}
</style>
