<script lang="ts">
	import Link from '#lib/site/Link.svelte';
</script>

<h1>Lab</h1>
<p class="lead">Plain pages that show kitcms features working. Not part of the studio site.</p>

<ul class="plain">
	<li><Link href="/lab/fields">Fields</Link> <span class="muted">every field type, rendered from one document</span></li>
	<li><Link href="/lab/access">Access</Link> <span class="muted">row-level and field-level read rules for the current visitor</span></li>
	<li><Link href="/lab/drafts">Drafts</Link> <span class="muted">what visitors see compared with the editors</span></li>
	<li><Link href="/admin">Admin</Link> <span class="muted">edit the content (the Lab group in the sidebar)</span></li>
</ul>
