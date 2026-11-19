<script lang="ts">
	// "Forgot password" (Decision 42): emails a reset link. The answer is the same whether or not
	// the account exists.
	import { enhance } from '$app/forms';
	import { adminHref } from '../links';

	let {
		title,
		logo,
		message,
		sent = false,
		emailEnabled,
	}: { title: string; logo?: string; message?: string; sent?: boolean; emailEnabled: boolean } = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- adminHref calls resolve() -->
<main class="auth">
	<form class="kc-card" method="POST" action="?/forgotPassword" use:enhance>
		{#if logo}<img class="logo" src={logo} alt={title} />{/if}
		<h1>Reset your password</h1>
		{#if sent}
			<p class="kc-alert kc-alert--success" role="status" data-testid="reset-sent">
				If there is an account for that email, we have sent it a link to choose a new password. The link works for
				one hour.
			</p>
		{:else if !emailEnabled}
			<p class="kc-muted">Email is not set up for this site, so a reset link cannot be sent. Ask an admin to set a new password for you.</p>
		{:else}
			<p class="kc-muted">Enter the email you sign in with. We will send you a link to choose a new password.</p>
			{#if message}<p class="kc-alert" role="alert" data-testid="error">{message}</p>{/if}
			<label>
				Email
				<input class="kc-input" name="email" type="email" autocomplete="username" required />
			</label>
			<button class="kc-btn kc-btn--primary">Send the link</button>
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
