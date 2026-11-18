<script lang="ts">
	// Read-only plugin panel (Decision 33). Core has already validated the content; text is rendered
	// as text only, there are no forms or actions.
	import type { AdminDataOf } from '@kitcms/core/client';
	import { formatBytes } from '../format';

	let { data }: { data: AdminDataOf<'panel'> } = $props();

	const fmt = (n: number, unit?: string) =>
		unit === 'bytes' ? formatBytes(n) : unit ? `${n.toLocaleString('en')} ${unit}` : n.toLocaleString('en');
	const external = (href: string) => href.startsWith('https:');
	const STATUS = { on: 'On', off: 'Off', locked: 'Locked' } as const;
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- link hrefs are validated by core (https: or /-relative) -->

<h1>{data.panel.label}</h1>
<div class="panel">
	{#each data.panel.content.blocks as block, i (i)}
		{#if block.type === 'heading'}
			<h2>{block.text}</h2>
		{:else if block.type === 'text'}
			<p class="tone-{block.tone ?? 'default'}">{block.text}</p>
		{:else if block.type === 'keyValue'}
			<dl class="kc-card kv">
				{#each block.items as item, j (j)}
					<dt>{item.label}</dt>
					<dd class="tone-{item.tone ?? 'default'}">{item.value}</dd>
				{/each}
			</dl>
		{:else if block.type === 'meter'}
			{@const unlimited = block.limit === null}
			{@const text = unlimited
				? `${fmt(block.used, block.unit)} used, Unlimited`
				: `${fmt(block.used, block.unit)} of ${fmt(block.limit ?? 0, block.unit)}`}
			<div class="kc-card meter">
				<div class="meter-head">
					<span>{block.label}</span>
					<span class="kc-muted">{unlimited ? `${fmt(block.used, block.unit)} · Unlimited` : text}</span>
				</div>
				{#if !unlimited && block.limit !== null && block.limit > 0}
					<div
						class="bar"
						role="meter"
						aria-label={block.label}
						aria-valuemin={0}
						aria-valuemax={block.limit}
						aria-valuenow={Math.min(block.used, block.limit)}
						aria-valuetext={text}
					>
						<span
							class:over={block.used >= block.limit}
							style:width="{Math.min(100, (block.used / block.limit) * 100)}%"
						></span>
					</div>
				{/if}
			</div>
		{:else if block.type === 'list'}
			<ul class="kc-card list">
				{#each block.items as item, j (j)}
					<li>
						<div>
							<strong>{item.label}</strong>
							{#if item.description}<p class="kc-muted">{item.description}</p>{/if}
						</div>
						{#if item.status}
							<span class="kc-badge status-{item.status}" data-status={item.status}>
								{#if item.status === 'locked'}<span aria-hidden="true">🔒</span>{/if}
								{STATUS[item.status]}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		{:else if block.type === 'link'}
			<a
				class="kc-btn link"
				href={block.href}
				target={external(block.href) ? '_blank' : undefined}
				rel={external(block.href) ? 'noopener noreferrer' : undefined}>{block.label}</a
			>
		{/if}
	{/each}
</div>

<style>
	.panel {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
		max-width: 44rem;
		justify-items: start;
	}
	.panel > * {
		max-width: 100%;
	}
	h2 {
		font-size: 1.05rem;
		margin-top: 0.5rem;
	}
	p {
		margin: 0;
	}
	.kv {
		display: grid;
		grid-template-columns: minmax(8rem, max-content) 1fr;
		gap: 0.4rem 1.5rem;
		margin: 0;
		width: 100%;
	}
	.kv dt {
		color: var(--kc-muted);
	}
	.kv dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.tone-ok {
		color: var(--kc-success);
	}
	.tone-warning {
		color: var(--kc-danger);
	}
	.tone-muted {
		color: var(--kc-muted);
	}
	.meter {
		display: grid;
		gap: 0.5rem;
		width: 100%;
	}
	.meter-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.bar {
		height: 0.5rem;
		border-radius: 999px;
		background: var(--kc-border);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--kc-accent);
	}
	.bar span.over {
		background: var(--kc-danger);
	}
	.list {
		list-style: none;
		margin: 0;
		display: grid;
		gap: 0.75rem;
		width: 100%;
	}
	.list li {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 1rem;
	}
	.status-on {
		border-color: var(--kc-success);
		color: var(--kc-success);
	}
	.status-locked {
		color: var(--kc-muted);
	}
	.link {
		min-height: 2.75rem;
	}
</style>
