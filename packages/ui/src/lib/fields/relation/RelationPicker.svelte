<script lang="ts">
	// Search box + results popup (ARIA combobox pattern). Used by relationship and upload fields.
	// Results render as a list, or as a thumbnail grid for uploads.
	import { searchDocs, isImage, type PickerDoc } from './api';

	let {
		id,
		collection,
		kind,
		exclude = [],
		disabled = false,
		placeholder = 'Search...',
		describedBy,
		invalid = false,
		onselect,
	}: {
		id: string;
		collection: string;
		kind: 'relationship' | 'upload';
		/** Ids not offered (already selected in a hasMany field). */
		exclude?: string[];
		disabled?: boolean;
		placeholder?: string;
		describedBy?: string;
		invalid?: boolean;
		onselect: (doc: PickerDoc) => void;
	} = $props();

	let query = $state('');
	let open = $state(false);
	let loading = $state(false);
	let failed = $state(false);
	let results = $state<PickerDoc[]>([]);
	let active = $state(-1);

	const listId = $derived(`${id}-list`);
	const optionId = (i: number) => `${id}-opt-${i}`;
	const shown = $derived(results.filter((d) => !exclude.includes(d.id)));

	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;

	async function run(q: string) {
		controller?.abort();
		controller = new AbortController();
		const signal = controller.signal;
		loading = true;
		failed = false;
		try {
			// Over-fetch a little so excluded ids don't empty the list.
			results = await searchDocs(collection, q, 10 + exclude.length, signal);
			active = results.length ? 0 : -1;
		} catch {
			if (signal.aborted) return;
			failed = true;
			results = [];
		} finally {
			if (!signal.aborted) loading = false;
		}
	}

	function schedule(q: string, delay = 200) {
		clearTimeout(timer);
		timer = setTimeout(() => void run(q), delay);
	}

	function oninput() {
		open = true;
		schedule(query);
	}
	function onfocus() {
		if (disabled) return;
		open = true;
		if (!results.length && !loading) schedule(query, 0);
	}
	function close() {
		open = false;
		active = -1;
	}
	function choose(doc: PickerDoc | undefined) {
		if (!doc) return;
		onselect(doc);
		query = '';
		close();
		results = [];
	}
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!open) {
				open = true;
				if (!results.length) schedule(query, 0);
			} else if (shown.length) active = (active + 1) % shown.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (shown.length) active = (active - 1 + shown.length) % shown.length;
		} else if (e.key === 'Home' && open && shown.length) {
			e.preventDefault();
			active = 0;
		} else if (e.key === 'End' && open && shown.length) {
			e.preventDefault();
			active = shown.length - 1;
		} else if (e.key === 'Enter') {
			// Never submit the form from the search box.
			e.preventDefault();
			if (open && active >= 0) choose(shown[active]);
		} else if (e.key === 'Escape' && open) {
			e.preventDefault();
			close();
		}
	}
	function onblur() {
		// Options use mousedown + preventDefault, so a blur always means "leave".
		close();
	}
</script>

<div class="kc-picker">
	<!-- No `name`: the field renders its own hidden inputs; the search text is never submitted. -->
	<input
		{id}
		class="kc-input"
		type="text"
		role="combobox"
		autocomplete="off"
		aria-autocomplete="list"
		aria-expanded={open}
		aria-controls={listId}
		aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
		aria-invalid={invalid ? 'true' : undefined}
		aria-describedby={describedBy}
		{placeholder}
		{disabled}
		bind:value={query}
		{oninput}
		{onfocus}
		{onkeydown}
		{onblur}
	/>
	{#if open}
		<ul
			id={listId}
			class="kc-card kc-picker__list"
			class:kc-picker__grid={kind === 'upload'}
			role="listbox"
			aria-label="Results"
		>
			{#each shown as doc, i (doc.id)}
				<li
					id={optionId(i)}
					role="option"
					aria-selected={active === i}
					class:kc-picker__active={active === i}
					onmousedown={(e) => {
						e.preventDefault();
						choose(doc);
					}}
					onmousemove={() => (active = i)}
				>
					{#if kind === 'upload'}
						{#if isImage(doc)}
							<img src={doc.url} alt="" loading="lazy" />
						{:else}
							<span class="kc-picker__file" aria-hidden="true">&#128196;</span>
						{/if}
						<span class="kc-picker__name">{doc.filename ?? doc.title}</span>
					{:else}
						<span>{doc.title}</span>
					{/if}
				</li>
			{/each}
			{#if loading}
				<li class="kc-muted kc-picker__status" role="presentation">Searching...</li>
			{:else if failed}
				<li class="kc-picker__status kc-picker__failed" role="presentation">Search failed. Try again.</li>
			{:else if shown.length === 0}
				<li class="kc-muted kc-picker__status" role="presentation">No results.</li>
			{/if}
		</ul>
	{/if}
</div>

<style>
	.kc-picker {
		position: relative;
	}
	.kc-picker__list {
		position: absolute;
		z-index: 10;
		inset-inline: 0;
		top: calc(100% + 0.25rem);
		margin: 0;
		padding: 0.25rem;
		list-style: none;
		max-height: 18rem;
		overflow: auto;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
	}
	.kc-picker__list li[role='option'] {
		padding: 0.4rem 0.5rem;
		border-radius: calc(var(--kc-radius) - 2px);
		cursor: pointer;
	}
	.kc-picker__active {
		background: color-mix(in srgb, var(--kc-accent) 15%, transparent);
	}
	.kc-picker__status {
		padding: 0.4rem 0.5rem;
		font-size: 0.875rem;
	}
	.kc-picker__failed {
		color: var(--kc-danger);
	}
	.kc-picker__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
		gap: 0.25rem;
	}
	.kc-picker__grid li[role='option'] {
		display: grid;
		gap: 0.25rem;
		justify-items: center;
		text-align: center;
	}
	.kc-picker__grid img,
	.kc-picker__file {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: calc(var(--kc-radius) - 2px);
		background: var(--kc-bg);
		display: grid;
		place-items: center;
		font-size: 2rem;
	}
	.kc-picker__name {
		font-size: 0.75rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
	.kc-picker__grid .kc-picker__status {
		grid-column: 1 / -1;
	}
</style>
