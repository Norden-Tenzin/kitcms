<script lang="ts">
	import '../site.css';
	import type { DesignId } from '../designs';
	import Img from '../Img.svelte';
	import { asMedia } from '../media';
	import type { BlockExtras, BlockOf } from './types';

	// `team` is loaded by the page route (see `../content.ts`). The admin preview has no data
	// source, so it shows a placeholder.
	// A "Editorial": rows with a small round portrait. B "Immersive": large portrait cards.
	// C "Structured": square tiles on a tinted ground.
	let {
		block,
		team,
		design = 'a',
	}: { block: BlockOf<'teamGrid'>; team?: BlockExtras['team']; design?: DesignId } = $props();
</script>

<section class="section" data-design={design}>
	<div class="container">
		{#if block.title}<h2>{block.title}</h2>{/if}
		{#if team}
			<ul class="grid">
				{#each team as member (member.id)}
					{@const photo = asMedia(member.photo)}
					<li>
						<div class="pic">
							{#if photo}
								<Img
									media={photo}
									ratio={design === 'b' ? 4 / 5 : 1}
									widths={[200, 400, 700]}
									sizes={design === 'a' ? '6rem' : '(min-width: 48rem) 30vw, 100vw'}
								/>
							{:else}
								<div class="avatar" aria-hidden="true">{member.name.slice(0, 1)}</div>
							{/if}
						</div>
						<div class="info">
							<h3>{member.name}</h3>
							{#if member.role}<p class="role">{member.role}</p>{/if}
							{#if member.bio}<p class="muted bio">{member.bio}</p>{/if}
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="placeholder">Team grid: the members of the Team collection appear here on the site.</p>
		{/if}
	</div>
</section>

<style>
	.section[data-design='a'] {
		--font-display: var(--font-serif);
	}
	.section[data-design='a'] h2 {
		font-weight: 600;
	}
	h2 {
		margin-bottom: var(--s-5);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-4);
	}
	li :global(img),
	.avatar {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: var(--radius);
	}
	.avatar {
		display: grid;
		place-items: center;
		font: 700 3rem/1 var(--font-display);
		background: var(--surface-2);
		color: var(--accent);
	}
	h3 {
		margin: 0;
		font-size: 1.2rem;
	}
	p {
		margin: 0.2rem 0 0;
	}
	.role {
		color: var(--accent);
		font-weight: 650;
		font-size: var(--step-small);
	}
	.bio {
		font-size: var(--step-small);
	}

	/* A: rows */
	.section[data-design='a'] li {
		display: flex;
		gap: var(--s-3);
		align-items: flex-start;
	}
	.section[data-design='a'] .pic {
		flex: none;
		width: 5.5rem;
	}
	.section[data-design='a'] li :global(img),
	.section[data-design='a'] .avatar {
		border-radius: 50%;
	}

	/* B: portrait cards */
	.section[data-design='b'] .grid {
		gap: var(--s-5) var(--s-3);
		grid-template-columns: repeat(2, 1fr);
	}
	.section[data-design='b'] .avatar {
		aspect-ratio: 4 / 5;
	}
	.section[data-design='b'] .info {
		margin-top: var(--s-2);
	}

	/* C: tiles */
	.section[data-design='c'] .grid {
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}
	.section[data-design='c'] li {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s-2);
		background: var(--surface);
		border-radius: 0.25rem;
	}
	.section[data-design='c'] li :global(img),
	.section[data-design='c'] .avatar {
		border-radius: 0.125rem;
	}

	@media (min-width: 48rem) {
		.section[data-design='a'] .grid {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--s-5) var(--s-6);
		}
		.section[data-design='b'] .grid {
			grid-template-columns: repeat(3, 1fr);
			gap: var(--s-5) var(--s-4);
		}
		.section[data-design='c'] .grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 0.5rem;
		}
	}
</style>
