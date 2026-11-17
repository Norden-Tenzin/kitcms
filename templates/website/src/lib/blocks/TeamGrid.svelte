<script lang="ts">
	import '../site.css';
	import Img from '../Img.svelte';
	import { asMedia } from '../media';
	import type { BlockExtras, BlockOf } from './types';

	// `team` is loaded by the page route (see `../content.ts`). The admin preview has no data
	// source, so it shows a placeholder.
	let { block, team }: { block: BlockOf<'teamGrid'>; team?: BlockExtras['team'] } = $props();
</script>

<section class="section">
	<div class="container">
		{#if block.title}<h2>{block.title}</h2>{/if}
		{#if team}
			<ul class="grid">
				{#each team as member (member.id)}
					{@const photo = asMedia(member.photo)}
					<li>
						{#if photo}
							<Img
								media={photo}
								ratio={1}
								widths={[200, 400, 600]}
								sizes="(min-width: 48rem) 20vw, 50vw"
							/>
						{:else}
							<div class="avatar" aria-hidden="true">{member.name.slice(0, 1)}</div>
						{/if}
						<h3>{member.name}</h3>
						{#if member.role}<p class="role">{member.role}</p>{/if}
						{#if member.bio}<p class="muted bio">{member.bio}</p>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="placeholder">
				Team grid: the members of the Team collection appear here on the site.
			</p>
		{/if}
	</div>
</section>

<style>
	.section {
		padding-block: clamp(2.5rem, 6vw, 4.5rem);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1.5rem;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
	}
	li :global(img),
	.avatar {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: var(--site-radius, 0.75rem);
		margin-bottom: 0.75rem;
	}
	.avatar {
		display: grid;
		place-items: center;
		font-size: 3rem;
		font-weight: 700;
		background: var(--site-surface, #fff);
		border: 1px solid var(--site-border, #e4e0d8);
		color: var(--site-accent, #1f5f4a);
	}
	h3 {
		margin: 0;
		font-size: 1.1rem;
	}
	p {
		margin: 0.15rem 0 0;
	}
	.role {
		color: var(--site-accent, #1f5f4a);
		font-weight: 600;
		font-size: 0.9rem;
	}
	.bio {
		font-size: 0.95rem;
	}
</style>
