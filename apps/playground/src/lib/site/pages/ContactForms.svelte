<script lang="ts">
	// The contact page's form: "Book a stay" (the booking enquiry) or "Ask a question" (name, email,
	// message). Radio tabs, so it works without JavaScript. `?room=` and `?offer=` prefill the booking
	// form and keep it selected.
	import { page } from '$app/state';
	import BookingForm from '../BookingForm.svelte';

	let { dark = false, id = 'contact' }: { dark?: boolean; id?: string } = $props();
	const room = $derived(page.url.searchParams.get('room') ?? '');
	const offer = $derived(page.url.searchParams.get('offer') ?? '');
	const experience = $derived(page.url.searchParams.get('experience') ?? '');
</script>

<div class="forms" class:dark>
	<input type="radio" name="{id}-kind" id="{id}-book" class="sr-only" checked />
	<input type="radio" name="{id}-kind" id="{id}-ask" class="sr-only" />
	<div class="tabs" role="group" aria-label="What would you like to do?">
		<label for="{id}-book">Book a stay</label>
		<label for="{id}-ask">Ask a question</label>
	</div>
	<div class="p book"><BookingForm form="booking" {room} {offer} {experience} {dark} id="{id}-b" /></div>
	<div class="p ask"><BookingForm form="contact" {dark} id="{id}-c" /></div>
</div>

<style>
	.forms {
		display: grid;
		gap: var(--s-5);
		min-width: 0;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.tabs label {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.4rem 1.1rem;
		border-radius: var(--radius);
		background: var(--field-bg, var(--bg));
		color: var(--ink);
		font-weight: 600;
		cursor: pointer;
	}
	input:nth-of-type(1):checked ~ .tabs label:nth-child(1),
	input:nth-of-type(2):checked ~ .tabs label:nth-child(2) {
		background: var(--ink);
		color: var(--bg);
	}
	input:nth-of-type(1):focus-visible ~ .tabs label:nth-child(1),
	input:nth-of-type(2):focus-visible ~ .tabs label:nth-child(2) {
		outline: 3px solid var(--accent);
		outline-offset: 3px;
	}
	.dark input:nth-of-type(1):focus-visible ~ .tabs label:nth-child(1),
	.dark input:nth-of-type(2):focus-visible ~ .tabs label:nth-child(2) {
		outline-color: var(--apricot);
	}
	input:nth-of-type(1):checked ~ .ask,
	input:nth-of-type(2):checked ~ .book {
		display: none;
	}
</style>
