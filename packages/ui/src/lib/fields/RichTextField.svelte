<script lang="ts">
	// Rich text (Tiptap), stored as ProseMirror JSON. Tiptap is lazy-loaded in onMount so it never
	// reaches the server bundle or public pages. Without JS (and until the editor mounts) the field
	// shows a read-only rendering and a hidden input carrying the stored JSON, so the value is
	// resubmitted unchanged. With JS the editor writes `value` on every update; an empty document
	// (a single empty paragraph) becomes `null`.
	import { onMount } from 'svelte';
	import type { FieldOf } from '@kitcms/core/client';
	import type { RichTextDoc } from '@kitcms/core';
	import { toHTML, safeHref } from '@kitcms/core/richtext';
	import { getFormContext } from '../form/context';
	import FieldShell from './FieldShell.svelte';
	import { fieldId, type FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'richText', 'client'>> = $props();

	const ctx = getFormContext();
	const id = $derived(fieldId(path));
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);
	const describedBy = $derived(
		[field.admin.description && `${id}-desc`, ctx.errors[path] && `${id}-err`]
			.filter(Boolean)
			.join(' ') || undefined,
	);

	const serialized = $derived(value ? JSON.stringify(value) : '');
	const staticHtml = $derived(toHTML(value as RichTextDoc | null | undefined));

	// Minimal structural type of the Tiptap editor we use (the real one is imported lazily).
	interface Chain {
		run(): boolean;
		toggleBold(): Chain;
		toggleItalic(): Chain;
		toggleStrike(): Chain;
		toggleCode(): Chain;
		toggleHeading(attrs: { level: number }): Chain;
		toggleBulletList(): Chain;
		toggleOrderedList(): Chain;
		toggleBlockquote(): Chain;
		toggleCodeBlock(): Chain;
		setHorizontalRule(): Chain;
		extendMarkRange(name: string): Chain;
		unsetLink(): Chain;
		setLink(attrs: { href: string }): Chain;
		undo(): Chain;
		redo(): Chain;
	}
	interface EditorLike {
		getJSON(): unknown;
		isEmpty: boolean;
		isActive(name: string, attrs?: object): boolean;
		getAttributes(name: string): Record<string, unknown>;
		can(): { undo(): boolean; redo(): boolean };
		chain(): { focus(): Chain };
		setEditable(editable: boolean): void;
		on(event: string, cb: () => void): void;
		destroy(): void;
	}

	let host: HTMLDivElement | undefined = $state();
	let editor: EditorLike | undefined = $state();
	let tick = $state(0); // bumped on every transaction so toolbar state re-derives

	const active = (name: string, attrs?: object) => {
		void tick;
		return editor?.isActive(name, attrs) ?? false;
	};
	const canUndo = $derived.by(() => (void tick, editor?.can().undo() ?? false));
	const canRedo = $derived.by(() => (void tick, editor?.can().redo() ?? false));

	const run = (fn: (c: Chain) => Chain) => fn(editor!.chain().focus()).run();

	function setLink() {
		if (!editor) return;
		const prev = (editor.getAttributes('link').href as string | undefined) ?? '';
		const input = window.prompt('Link URL (http, https, mailto, tel, relative or #). Empty removes the link.', prev);
		if (input === null) return;
		const url = input.trim();
		if (url === '') {
			run((c) => c.extendMarkRange('link').unsetLink());
		} else if (safeHref(url) !== null) {
			run((c) => c.extendMarkRange('link').setLink({ href: url }));
		} else {
			window.alert('That URL is not allowed.');
		}
	}

	const buttons: { label: string; name: string; attrs?: object; act: () => void }[] = [
		{ label: 'Bold', name: 'bold', act: () => run((c) => c.toggleBold()) },
		{ label: 'Italic', name: 'italic', act: () => run((c) => c.toggleItalic()) },
		{ label: 'Strikethrough', name: 'strike', act: () => run((c) => c.toggleStrike()) },
		{ label: 'Code', name: 'code', act: () => run((c) => c.toggleCode()) },
		{ label: 'Heading 2', name: 'heading', attrs: { level: 2 }, act: () => run((c) => c.toggleHeading({ level: 2 })) },
		{ label: 'Heading 3', name: 'heading', attrs: { level: 3 }, act: () => run((c) => c.toggleHeading({ level: 3 })) },
		{ label: 'Bullet list', name: 'bulletList', act: () => run((c) => c.toggleBulletList()) },
		{ label: 'Numbered list', name: 'orderedList', act: () => run((c) => c.toggleOrderedList()) },
		{ label: 'Quote', name: 'blockquote', act: () => run((c) => c.toggleBlockquote()) },
		{ label: 'Code block', name: 'codeBlock', act: () => run((c) => c.toggleCodeBlock()) },
		{ label: 'Divider', name: 'horizontalRule', act: () => run((c) => c.setHorizontalRule()) },
		{ label: 'Link', name: 'link', act: setLink },
	];
	const short: Record<string, string> = {
		Bold: 'B', Italic: 'I', Strikethrough: 'S', Code: '</>', 'Heading 2': 'H2', 'Heading 3': 'H3',
		'Bullet list': '•', 'Numbered list': '1.', Quote: '❝', 'Code block': '{ }', Divider: '—', Link: 'Link',
	};

	onMount(() => {
		let dead = false;
		let ed: EditorLike | undefined;
		(async () => {
			// onMount never runs on the server; this constant also lets the SSR build drop the
			// dynamic imports, so Tiptap stays out of the server bundle entirely.
			if (import.meta.env.SSR) return;
			const [{ Editor }, { default: StarterKit }, { default: Link }] = await Promise.all([
				import('@tiptap/core'),
				import('@tiptap/starter-kit'),
				import('@tiptap/extension-link'),
			]);
			if (dead || !host) return;
			const instance = new Editor({
				element: host,
				editable: !readOnly,
				content: (value as RichTextDoc | null) ?? undefined,
				extensions: [
					StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
					Link.configure({
						openOnClick: false,
						autolink: false,
						// Only the URLs the serializer would render (the editor and the output agree).
						isAllowedUri: (url: string) => safeHref(url) !== null,
					}),
				],
				editorProps: {
					attributes: {
						id,
						role: 'textbox',
						'aria-multiline': 'true',
						'aria-label': field.label,
						...(describedBy ? { 'aria-describedby': describedBy } : {}),
					},
				},
				onUpdate: ({ editor: e }) => {
					value = e.isEmpty ? null : (e.getJSON() as unknown);
				},
				onTransaction: () => {
					tick++;
				},
			});
			ed = instance as unknown as EditorLike;
			editor = ed;
		})();
		return () => {
			dead = true;
			ed?.destroy();
			editor = undefined;
		};
	});

	$effect(() => {
		editor?.setEditable(!readOnly);
	});
</script>

<FieldShell {field} {path}>
	<div
		class="kc-rt"
		class:kc-rt--readonly={readOnly}
		class:kc-rt--invalid={ctx.errors[path]}
	>
		{#if editor && !readOnly}
			<div class="kc-rt__toolbar" role="toolbar" aria-label="Formatting" aria-controls={id}>
				{#each buttons as b (b.label)}
					<button
						type="button"
						class="kc-rt__btn"
						title={b.label}
						aria-label={b.label}
						aria-pressed={active(b.name, b.attrs)}
						onclick={b.act}
					>{short[b.label]}</button>
				{/each}
				<span class="kc-rt__sep" aria-hidden="true"></span>
				<button type="button" class="kc-rt__btn" title="Undo" aria-label="Undo" disabled={!canUndo} onclick={() => run((c) => c.undo())}>↶</button>
				<button type="button" class="kc-rt__btn" title="Redo" aria-label="Redo" disabled={!canRedo} onclick={() => run((c) => c.redo())}>↷</button>
			</div>
		{/if}
		{#if !editor}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- toHTML escapes all text and attributes -->
			<div class="kc-rt__static kc-rt__content" aria-describedby={describedBy}>{@html staticHtml}</div>
		{/if}
		<div class="kc-rt__editor kc-rt__content" bind:this={host} hidden={!editor}></div>
	</div>
	<input type="hidden" name={path} value={serialized} disabled={readOnly} />
</FieldShell>

<style>
	.kc-rt {
		border: 1px solid var(--kc-border);
		border-radius: var(--kc-radius);
		background: var(--kc-surface);
		color: var(--kc-text);
	}
	.kc-rt--invalid {
		border-color: var(--kc-danger);
	}
	.kc-rt--readonly {
		opacity: 0.8;
	}
	.kc-rt__toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem;
		border-bottom: 1px solid var(--kc-border);
	}
	.kc-rt__btn {
		min-width: 2rem;
		height: 2rem;
		padding: 0 0.5rem;
		font: inherit;
		font-size: 0.8125rem;
		color: var(--kc-text);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--kc-radius);
		cursor: pointer;
	}
	.kc-rt__btn:hover:not(:disabled) {
		border-color: var(--kc-border);
	}
	.kc-rt__btn[aria-pressed='true'] {
		color: var(--kc-accent-text);
		background: var(--kc-accent);
	}
	.kc-rt__btn:disabled {
		color: var(--kc-muted);
		cursor: default;
	}
	.kc-rt__btn:focus-visible {
		outline: 2px solid var(--kc-accent);
		outline-offset: 1px;
	}
	.kc-rt__sep {
		width: 1px;
		height: 1.25rem;
		margin: 0 0.25rem;
		background: var(--kc-border);
	}
	.kc-rt__content {
		min-height: 8rem;
		padding: 0.5rem 0.75rem;
		line-height: 1.5;
	}
	.kc-rt__content :global(.ProseMirror) {
		min-height: 7rem;
		outline: none;
	}
	.kc-rt__content :global(.ProseMirror:focus-visible) {
		outline: 2px solid var(--kc-accent);
		outline-offset: 4px;
		border-radius: 2px;
	}
	.kc-rt__content :global(p),
	.kc-rt__content :global(ul),
	.kc-rt__content :global(ol),
	.kc-rt__content :global(pre),
	.kc-rt__content :global(blockquote) {
		margin: 0 0 0.75em;
	}
	.kc-rt__content :global(h2),
	.kc-rt__content :global(h3),
	.kc-rt__content :global(h4) {
		margin: 0.75em 0 0.4em;
		line-height: 1.25;
	}
	.kc-rt__content :global(blockquote) {
		padding-left: 0.75rem;
		border-left: 3px solid var(--kc-border);
		color: var(--kc-muted);
	}
	.kc-rt__content :global(pre),
	.kc-rt__content :global(code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.875em;
		background: var(--kc-bg);
		border-radius: 4px;
	}
	.kc-rt__content :global(pre) {
		padding: 0.5rem 0.75rem;
		overflow-x: auto;
	}
	.kc-rt__content :global(code) {
		padding: 0.1em 0.3em;
	}
	.kc-rt__content :global(pre code) {
		padding: 0;
		background: none;
	}
	.kc-rt__content :global(hr) {
		border: 0;
		border-top: 1px solid var(--kc-border);
	}
	.kc-rt__content :global(a) {
		color: var(--kc-accent);
	}
	.kc-rt__static {
		color: var(--kc-text);
	}
</style>
