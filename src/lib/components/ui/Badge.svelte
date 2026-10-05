<script lang="ts">
	import type { RequestStatusKey, NotificationType } from '$lib/types';

	type BadgeValue = RequestStatusKey | NotificationType | string;

	interface Props {
		value: BadgeValue;
		size?: 'sm' | 'md';
	}

	const { value, size = 'md' }: Props = $props();

	const colorMap: Record<string, string> = {
		// RequestStatus (lowercased — see RequestStatusKey)
		pending: 'bg-orange-100 text-orange-700 border border-orange-200',
		approved: 'bg-green-100 text-green-700 border border-green-200',
		rejected: 'bg-red-100 text-red-700 border border-red-200',
		'correction requested': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
		// NotificationType
		request: 'bg-blue-100 text-blue-700 border border-blue-200',
		task: 'bg-purple-100 text-purple-700 border border-purple-200',
		system: 'bg-gray-100 text-gray-600 border border-gray-200'
	};

	const labelMap: Record<string, string> = {
		'correction requested': 'Correction Requested'
	};

	const classes = $derived(colorMap[value] ?? 'bg-gray-100 text-gray-600 border border-gray-200');
	const label = $derived(labelMap[value] ?? value.charAt(0).toUpperCase() + value.slice(1));
	const sizeClass = $derived(size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1');
</script>

<span class="ui-badge inline-flex items-center rounded-full font-medium {sizeClass} {classes}">
	{label}
</span>
