<script lang="ts">
	import type { ClientField, LayoutNode } from '@kitcms/core/client';
	import Self from './RenderNodes.svelte';
	import { fieldComponents } from './registry';

	let {
		nodes,
		byName,
		visible,
		values = $bindable(),
		prefix,
	}: {
		nodes: LayoutNode[];
		byName: Map<string, ClientField>;
		visible: (f: ClientField) => boolean;
		values: Record<string, unknown>;
		prefix: string;
	} = $props();

	let activeTab = $state(0);

	const pathOf = (name: string) => (prefix ? `${prefix}.${name}` : name);
	/** Whether a subtree has anything to show (empty rows/tabs/collapsibles are skipped). */
	function hasVisible(list: LayoutNode[]): boolean {
		return list.some((n) => {
			if (n.kind === 'field') {
				const f = byName.get(n.name);
				return f !== undefined && visible(f);
			}
			if (n.kind === 'tabs') return n.tabs.some((t) => hasVisible(t.children));
			return hasVisible(n.children);
		});
	}
</script>

{#each nodes as node, i (i)}
	{#if node.kind === 'field'}
		{@const field = byName.get(node.name)}
		{#if field && visible(field)}
			{@const Comp = fieldComponents[field.type]}
			{#if Comp}
				<Comp {field} path={pathOf(field.name)} bind:value={values[field.name]} />
			{:else}
				<p class="kc-missing">No admin component for "{field.type}" fields ({field.name}).</p>
			{/if}
		{/if}
	{:else if node.kind === 'row'}
		{#if hasVisible(node.children)}
			<div class="kc-row">
				<Self nodes={node.children} {byName} {visible} bind:values {prefix} />
			</div>
		{/if}
	{:else if node.kind === 'collapsible'}
		{#if hasVisible(node.children)}
			<details class="kc-collapsible" open={!node.initCollapsed}>
				<summary>{node.label}</summary>
				<div class="kc-collapsible__body">
					<Self nodes={node.children} {byName} {visible} bind:values {prefix} />
				</div>
			</details>
		{/if}
	{:else if node.kind === 'tabs'}
		{@const tabs = node.tabs.filter((t) => hasVisible(t.children))}
		{#if tabs.length > 0}
			<div class="kc-tabs">
				<div class="kc-tabs__list" role="tablist">
					{#each tabs as tab, t (t)}
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === t}
							onclick={() => (activeTab = t)}>{tab.label}</button
						>
					{/each}
				</div>
				<!-- All panels stay in the DOM (hidden), so every input is still submitted. -->
				{#each tabs as tab, t (t)}
					<div role="tabpanel" hidden={activeTab !== t}>
						{#if tab.description}<p class="kc-tabs__desc">{tab.description}</p>{/if}
						<Self nodes={tab.children} {byName} {visible} bind:values {prefix} />
					</div>
				{/each}
			</div>
		{/if}
	{/if}
{/each}

<style>
	.kc-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.kc-row > :global(*) {
		flex: 1 1 12rem;
	}
	.kc-collapsible {
		border: 1px solid var(--kc-border);
		border-radius: var(--kc-radius);
		padding: 0.5rem 0.75rem;
	}
	.kc-collapsible summary {
		cursor: pointer;
		font-weight: 600;
	}
	.kc-collapsible__body,
	[role='tabpanel'] {
		display: grid;
		gap: 1rem;
		padding-top: 0.75rem;
	}
	.kc-tabs__list {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--kc-border);
	}
	.kc-tabs__list button {
		background: none;
		border: 0;
		border-bottom: 2px solid transparent;
		padding: 0.5rem 0.75rem;
		color: var(--kc-muted);
		cursor: pointer;
	}
	.kc-tabs__list button[aria-selected='true'] {
		color: var(--kc-text);
		border-bottom-color: var(--kc-accent);
	}
	.kc-tabs__desc {
		margin: 0;
		color: var(--kc-muted);
	}
	.kc-missing {
		color: var(--kc-danger);
	}
</style>
