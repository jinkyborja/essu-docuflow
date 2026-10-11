<script lang="ts">
	import { page } from '$app/stores';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';
</script>

<ErrorState
	status={$page.status}
	message={$page.error?.message}
	homeHref="/staff/dashboard"
	homeLabel="Go to Dashboard"
/>
