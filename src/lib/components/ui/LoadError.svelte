<script lang="ts">
	import Button from './Button.svelte';
	let { message = 'We couldn’t load this information. Please try again.', onretry }: { message?: string; onretry: () => void } = $props();
</script>
<div role="alert" class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p class="min-w-0 flex-1">{message}</p><Button variant="secondary" onclick={onretry}>Try again</Button></div>
