<script lang="ts">
	import type { RequestStatusKey, NotificationType } from '$lib/types';
	import StatusChip from './StatusChip.svelte';
	import { requestStatusKey, statusLabel } from '$lib/request-status';

	type BadgeValue = RequestStatusKey | NotificationType | string;

	interface Props {
		value: BadgeValue;
		size?: 'sm' | 'md';
	}

	const { value, size = 'md' }: Props = $props();

	const colorMap: Record<string, string> = {
		completed: 'bg-green-100 text-green-700 border border-green-200',
		// NotificationType
		request: 'bg-blue-100 text-blue-700 border border-blue-200',
		task: 'bg-purple-100 text-purple-700 border border-purple-200',
		system: 'bg-gray-100 text-gray-600 border border-gray-200'
	};

</script>

{#if requestStatusKey(value)}<StatusChip {value} {size} />{:else}<span class="ui-badge inline-flex items-center rounded-full font-medium {size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'} text-xs {colorMap[value.toLowerCase()] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}">{statusLabel(value)}</span>{/if}
