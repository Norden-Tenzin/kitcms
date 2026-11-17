<script lang="ts">
	// Modal media library for one upload collection: search, "Load more" paging, an upload drop
	// zone (new files are selected right away), single/multiple selection and Confirm/Cancel.
	//
	// Props are the collection slug plus, optionally, its upload rules (`mimeTypes`, `maxFileSize`)
	// for client-side pre-validation. UploadField only knows the target slug, so it omits `upload`
	// and the server remains the authority on what is accepted.
	//
	// `onselect` receives only the NEWLY chosen documents. `selectedIds` (already chosen elsewhere,
	// e.g. in the field) are shown as "Added", can't be toggled in `multiple` mode and count toward `max`.
	import { untrack } from 'svelte';
	import { searchPage, type PickerDoc } from '../fields/relation/api';
	import FileUpload from '../upload/FileUpload.svelte';
	import { fileLabel, isImageMime, metaLine, thumbUrl } from './util';

	let {
		open = $bindable(false),
		collection,
		upload,
		multiple = false,
		max,
		selectedIds = [],
		onselect,
	}: {
		open?: boolean;
		/** Upload collection slug. */
		collection: string;
		/** Upload rules of the collection, when known (enables client-side file checks). */
		upload?: { mimeTypes: string[]; maxFileSize: number };
		multiple?: boolean;
		/** Maximum total selection, including `selectedIds`. */
		max?: number;
		selectedIds?: string[];
		onselect: (docs: PickerDoc[]) => void;
	} = $props();

	const PAGE = 24;
	const titleId = `kc-mp-${Math.random().toString(36).slice(2, 8)}`;
	let dialog: HTMLDialogElement | undefined = $state();

	let q = $state('');
	let docs = $state<PickerDoc[]>([]);
	let page = $state(1);
	let hasNext = $state(false);
	let loading = $state(false);
	let error = $state('');
	let chosen = $state<PickerDoc[]>([]);

	const rules = $derived(upload ?? { mimeTypes: [], maxFileSize: Number.POSITIVE_INFINITY });
	const taken = $derived(multiple ? selectedIds.length : 0);
	const room = $derived(max === undefined ? Number.POSITIVE_INFINITY : Math.max(max - taken, 0));
	const isChosen = (id: string) => chosen.some((d) => d.id === id);

	// Keep the native dialog in sync with `open` (Escape / backdrop close updates it back).
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			chosen = [];
			q = '';
			dialog.showModal();
		} else if (!open && dialog.open) dialog.close();
	});

	let seq = 0;
	async function load(reset: boolean) {
		const mine = ++seq;
		loading = true;
		error = '';
		const next = reset ? 1 : page + 1;
		try {
			const res = await searchPage(collection, q, next, PAGE);
			if (mine !== seq) return;
			docs = reset ? res.docs : [...docs, ...res.docs.filter((d) => !docs.some((e) => e.id === d.id))];
			page = next;
			hasNext = res.hasNextPage;
		} catch {
			if (mine === seq) error = 'Could not load the media library.';
		} finally {
			if (mine === seq) loading = false;
		}
	}

	// (Re)load when opened or the search text changes (debounced).
	$effect(() => {
		if (!open) return;
		const text = q;
		const t = setTimeout(() => untrack(() => void load(true)), text ? 250 : 0);
		return () => clearTimeout(t);
	});

	function toggle(doc: PickerDoc) {
		if (!multiple) {
			chosen = isChosen(doc.id) ? [] : [doc];
		} else if (isChosen(doc.id)) {
			chosen = chosen.filter((d) => d.id !== doc.id);
		} else if (chosen.length < room) {
			chosen = [...chosen, doc];
		}
	}

	function uploaded(raw: Record<string, unknown>) {
		const doc: PickerDoc = {
			id: String(raw.id),
			title: String(raw.filename ?? raw.id),
			url: typeof raw.url === 'string' ? raw.url : undefined,
			mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : undefined,
			filename: typeof raw.filename === 'string' ? raw.filename : undefined,
			width: typeof raw.width === 'number' ? raw.width : null,
			height: typeof raw.height === 'number' ? raw.height : null,
			filesize: typeof raw.filesize === 'number' ? raw.filesize : undefined,
		};
		docs = [doc, ...docs.filter((d) => d.id !== doc.id)];
		if (!multiple) chosen = [doc];
		else if (chosen.length < room) chosen = [...chosen, doc];
	}

	function confirm() {
		if (chosen.length) onselect(chosen);
		open = false;
	}
</script>

<dialog
	bind:this={dialog}
	class="kc-mp"
	aria-labelledby={titleId}
	onclose={() => (open = false)}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
>
	{#if open}
		<div class="kc-mp__body">
			<header class="kc-mp__head">
				<h2 id={titleId}>Media library</h2>
				<button type="button" class="kc-btn kc-btn--ghost" aria-label="Close" onclick={() => (open = false)}>&times;</button>
			</header>

			<input
				class="kc-input"
				type="search"
				placeholder="Search files"
				aria-label="Search files"
				bind:value={q}
			/>

			<FileUpload collection={{ slug: collection, upload: rules }} showCurrent={false} onuploaded={uploaded} />

			{#if error}<p class="kc-mp__error" role="alert">{error}</p>{/if}

			<ul class="kc-mp__grid" aria-label="Files" aria-busy={loading}>
				{#each docs as doc (doc.id)}
					{@const already = multiple && selectedIds.includes(doc.id)}
					{@const picked = isChosen(doc.id)}
					<li>
						<button
							type="button"
							class="kc-card kc-mp__tile"
							class:kc-mp__tile--picked={picked}
							aria-pressed={picked || already}
							disabled={already || (multiple && !picked && chosen.length >= room)}
							onclick={() => toggle(doc)}
						>
							<span class="kc-mp__thumb">
								{#if isImageMime(doc.mimeType) && doc.url}
									<img src={thumbUrl(doc.url, 240)} alt="" loading="lazy" />
								{:else}
									<span class="kc-mp__file" aria-hidden="true">{fileLabel(doc.mimeType, doc.filename)}</span>
								{/if}
							</span>
							<span class="kc-mp__name">{doc.filename ?? doc.title}</span>
							<span class="kc-mp__meta">{already ? 'Added' : metaLine(doc)}</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if !loading && docs.length === 0 && !error}
				<p class="kc-muted">{q ? 'No files match your search.' : 'No files yet. Upload one above.'}</p>
			{/if}
			{#if hasNext}
				<button type="button" class="kc-btn kc-mp__more" disabled={loading} onclick={() => load(false)}>
					{loading ? 'Loading...' : 'Load more'}
				</button>
			{/if}

			<footer class="kc-mp__foot">
				<span class="kc-muted" aria-live="polite">
					{chosen.length} selected{max !== undefined ? ` (max ${max})` : ''}
				</span>
				<button type="button" class="kc-btn" onclick={() => (open = false)}>Cancel</button>
				<button type="button" class="kc-btn kc-btn--primary" disabled={chosen.length === 0} onclick={confirm}>
					Confirm
				</button>
			</footer>
		</div>
	{/if}
</dialog>

<style>
	.kc-mp {
		width: min(60rem, 94vw);
		max-height: 90vh;
		padding: 0;
		border: 1px solid var(--kc-border);
		border-radius: var(--kc-radius);
		background: var(--kc-surface);
		color: var(--kc-text);
	}
	.kc-mp::backdrop {
		background: rgb(0 0 0 / 0.5);
	}
	.kc-mp__body {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
	}
	.kc-mp__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.kc-mp__head h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.kc-mp__error {
		margin: 0;
		color: var(--kc-danger);
	}
	.kc-mp__grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: 0.5rem;
	}
	.kc-mp__tile {
		width: 100%;
		display: grid;
		gap: 0.15rem;
		padding: 0.4rem;
		text-align: left;
		cursor: pointer;
		font: inherit;
		color: inherit;
	}
	.kc-mp__tile:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.kc-mp__tile--picked {
		border-color: var(--kc-accent);
		outline: 2px solid var(--kc-accent);
	}
	.kc-mp__thumb {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		overflow: hidden;
		background: var(--kc-bg);
		border-radius: calc(var(--kc-radius) - 2px);
	}
	.kc-mp__thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.kc-mp__file {
		font-weight: 700;
		color: var(--kc-muted);
	}
	.kc-mp__name {
		font-size: 0.8rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.kc-mp__meta {
		font-size: 0.7rem;
		color: var(--kc-muted);
		min-height: 1em;
	}
	.kc-mp__more {
		justify-self: center;
	}
	.kc-mp__foot {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.kc-mp__foot > span {
		margin-right: auto;
	}
</style>
