<script lang="ts">
	// The people, from the `team` collection. Initials stand in when there is no photo.
	// A: four columns. B: two large columns with the bio. C: rows.
	import type { DesignId } from '../designs';
	import { initials } from '../format';
	import { asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import Placeholder from './Placeholder.svelte';
	import SectionHead from './SectionHead.svelte';
	import type { BlockOf, TeamMember } from '../types';

	let { block, team, design = 'a' }: { block: BlockOf<'teamGrid'>; team?: TeamMember[]; design?: DesignId } = $props();
</script>

{#if !team}
	<Placeholder title={block.heading || 'Team'} text="Shows the people from the Team collection." />
{:else if team.length}
	<section class="blk section" data-design={design}>
		<div class="container">
			<SectionHead heading={block.heading} />
			<ul>
				{#each team as m, i (m.id)}
					<li class="reveal" use:reveal style:--i={i}>
						<div class="avatar">
							{#if asMedia(m.photo)}
								<Pic media={asMedia(m.photo)} ratio={1} widths={[300, 600]} sizes="25vw" />
							{:else}
								<span aria-hidden="true">{initials(m.name)}</span>
							{/if}
						</div>
						<div class="text">
							<h3>{m.name}</h3>
							{#if m.role}<p class="role">{m.role}</p>{/if}
							{#if m.bio}<p class="muted bio">{m.bio}</p>{/if}
						</div>
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<style>
	ul {
		list-style: none;
		display: grid;
		gap: var(--s-5);
	}
	li {
		display: grid;
		gap: var(--s-3);
		align-content: start;
	}
	.avatar {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		background: var(--surface-2);
		font: clamp(3rem, 2rem + 4vw, 5.5rem) / 1 var(--font-display);
		color: var(--accent);
		overflow: hidden;
	}
	[data-design='b'] .avatar {
		background: var(--accent);
		color: var(--accent-ink);
	}
	h3 {
		font-size: 1.75rem;
	}
	.role {
		font-weight: 600;
		font-size: var(--step-small);
		margin-top: 0.25rem;
	}
	.bio {
		margin-top: var(--s-2);
		max-width: 34rem;
	}
	[data-design='a'] .bio {
		display: none;
	}
	@media (min-width: 40rem) {
		[data-design='a'] ul {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--s-5) var(--s-3);
		}
		[data-design='a'] .bio {
			display: block;
		}
	}
	@media (min-width: 56rem) {
		[data-design='a'] ul {
			grid-template-columns: repeat(4, 1fr);
		}
		[data-design='a'] .bio {
			display: none;
		}
		[data-design='b'] ul {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-6) var(--s-5);
		}
		[data-design='b'] li {
			grid-template-columns: 1fr 1.4fr;
			align-items: end;
		}
		[data-design='c'] li {
			grid-template-columns: 8rem 1fr;
			align-items: center;
			gap: var(--s-5);
			padding-block: var(--s-3);
		}
		[data-design='c'] li:nth-child(odd) {
			background: var(--surface);
			margin-inline: calc(var(--gutter) * -1);
			padding-inline: var(--gutter);
		}
		[data-design='c'] ul {
			gap: 0;
		}
	}
</style>
