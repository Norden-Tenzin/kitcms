<script lang="ts">
	// First-run screen: creates the first admin. The server re-checks that no user exists at submit time.
	import { enhance } from '$app/forms';

	let { message }: { message?: string } = $props();
</script>

<h1>Create the first admin</h1>
<form method="POST" action="?/createFirstUser" use:enhance>
	<label>
		Name
		<input name="name" autocomplete="name" required />
	</label>
	<label>
		Email
		<input name="email" type="email" autocomplete="username" required />
	</label>
	<label>
		Password
		<input name="password" type="password" autocomplete="new-password" minlength="8" required />
	</label>
	<button>Create admin</button>
</form>
{#if message}<p data-testid="error" role="alert">{message}</p>{/if}
