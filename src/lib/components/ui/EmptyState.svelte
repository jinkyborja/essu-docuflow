<script lang="ts">
	interface Props {
		message?: string;
		icon?: string;
		description?: string;
	}

	const {
		message = 'No results found',
		icon = 'fa-solid fa-inbox',
		description
	}: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center">
	<div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
		<i class="{icon} text-2xl text-gray-400"></i>
	</div>
	<p class="text-gray-600 font-medium">{message}</p>
	{#if description}
		<p class="text-sm text-gray-400 mt-1 max-w-xs">{description}</p>
	{/if}
</div>
