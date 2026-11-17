<script lang="ts">
	// Sign-in form. Posts to the admin `login` action (same-origin checked on the server).
	import { enhance } from '$app/forms';

	let { title, logo, message }: { title: string; logo?: string; message?: string } = $props();
</script>

<main class="auth">
	<form class="kc-card" method="POST" action="?/login" use:enhance>
		{#if logo}<img class="logo" src={logo} alt={title} />{/if}
		<h1>{title}</h1>
		<p class="kc-muted">Sign in to continue.</p>
		{#if message}<p class="kc-alert" role="alert" data-testid="error">{message}</p>{/if}
		<label>
			Email
			<input class="kc-input" name="email" type="email" autocomplete="username" required />
		</label>
		<label>
			Password
			<input
				class="kc-input"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</label>
		<button class="kc-btn kc-btn--primary">Sign in</button>
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
	.logo {
		height: 2.5rem;
		width: auto;
		justify-self: start;
	}
</style>
