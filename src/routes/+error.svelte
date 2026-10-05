<script lang="ts">
	import { page } from '$app/stores';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
	<ErrorState
		status={$page.status}
		message={$page.error?.message}
		homeHref="/"
		homeLabel="Go to Sign In"
	/>
</div>
