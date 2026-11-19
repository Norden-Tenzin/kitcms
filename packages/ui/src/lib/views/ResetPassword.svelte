<script lang="ts">
	// Opened from a reset or invite link (Decision 42): choose a password, then you're signed in.
	import { enhance } from '$app/forms';
	import { adminHref } from '../links';

	let {
		title,
		logo,
		message,
		token,
		link,
	}: {
		title: string;
		logo?: string;
		message?: string;
		token: string;
		link: { kind: 'reset' | 'invite'; email: string } | null;
	} = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- adminHref calls resolve() -->
<main class="auth">
	<form class="kc-card" method="POST" action="?/resetPassword" use:enhance>
		{#if logo}<img class="logo" src={logo} alt={title} />{/if}
		<h1>{link?.kind === 'invite' ? `Welcome to ${title}` : 'Choose a new password'}</h1>
		{#if !link}
			<p class="kc-alert" role="alert" data-testid="error">This link is invalid or has expired.</p>
			<a class="kc-btn" href={adminHref('forgot-password')}>Ask for a new link</a>
		{:else}
			<p class="kc-muted">
				{link.kind === 'invite' ? 'Choose a password to sign in as' : 'For'} <strong>{link.email}</strong>.
			</p>
			{#if message}<p class="kc-alert" role="alert" data-testid="error">{message}</p>{/if}
			<input type="hidden" name="token" value={token} />
			<input type="hidden" name="email" autocomplete="username" value={link.email} />
			<label>
				New password
				<input class="kc-input" name="password" type="password" autocomplete="new-password" minlength="8" required />
			</label>
			<label>
				Repeat it
				<input class="kc-input" name="confirm" type="password" autocomplete="new-password" minlength="8" required />
			</label>
			<button class="kc-btn kc-btn--primary">{link.kind === 'invite' ? 'Set password and sign in' : 'Save and sign in'}</button>
		{/if}
		<a class="kc-muted back" href={adminHref('login')}>Back to sign in</a>
	</form>
</main>

<style>
	.auth {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1rem;
	}
	form {
		display: grid;
		gap: 0.9rem;
		width: min(100%, 22rem);
		padding: 1.5rem;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-weight: 500;
	}
	p {
		margin: 0;
	}
	.back {
		justify-self: start;
		font-size: 0.9rem;
	}
	.logo {
		height: 2.5rem;
		width: auto;
		justify-self: start;
	}
</style>
