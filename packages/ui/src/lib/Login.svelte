<script lang="ts">
	// Sign-in form. Posts to the admin `login` action (same-origin checked on the server).
	import { enhance } from '$app/forms';

	let { message }: { message?: string } = $props();
</script>

<h1>Sign in</h1>
<form method="POST" action="?/login" use:enhance>
	<label>
		Email
		<input name="email" type="email" autocomplete="username" required />
	</label>
	<label>
		Password
		<input name="password" type="password" autocomplete="current-password" required />
	</label>
	<button>Sign in</button>
</form>
{#if message}<p data-testid="error" role="alert">{message}</p>{/if}
