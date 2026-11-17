<script lang="ts">
	// Shown once, while the auth collection is empty: creates the first admin user.
	import { enhance } from '$app/forms';

	let { title, message }: { title: string; message?: string } = $props();
</script>

<main class="auth">
	<form class="kc-card" method="POST" action="?/createFirstUser" use:enhance>
		<h1>{title}</h1>
		<p class="kc-muted">Create the first admin user.</p>
		{#if message}<p class="kc-alert" role="alert" data-testid="error">{message}</p>{/if}
		<label>
			Name
			<input class="kc-input" name="name" autocomplete="name" required />
		</label>
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
				autocomplete="new-password"
				minlength="8"
				required
			/>
		</label>
		<button class="kc-btn kc-btn--primary">Create account</button>
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
</style>
