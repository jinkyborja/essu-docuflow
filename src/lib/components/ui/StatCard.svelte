<script lang="ts">
	interface Props {
		label: string;
		value: string | number;
		icon: string;
		color?: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'teal' | 'gold';
		trend?: { value: number; label?: string };
		subtitle?: string;
	}

	const { label, value, icon, color = 'green', trend, subtitle }: Props = $props();

	const colorMap: Record<string, { bg: string; icon: string; trend: string }> = {
		green: { bg: 'bg-green-50', icon: 'bg-green-100 text-essu-green-mid', trend: 'text-green-600' },
		blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', trend: 'text-blue-600' },
		orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600', trend: 'text-orange-600' },
		red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', trend: 'text-red-600' },
		purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', trend: 'text-purple-600' },
		teal: { bg: 'bg-teal-50', icon: 'bg-teal-100 text-teal-600', trend: 'text-teal-600' },
		gold: { bg: 'bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600', trend: 'text-yellow-600' }
	};

	const colors = $derived(colorMap[color]);
</script>

<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
	<div class="shrink-0 w-12 h-12 rounded-xl {colors.icon} flex items-center justify-center">
		<i class="{icon} text-xl"></i>
	</div>
	<div class="flex-1 min-w-0">
		<p class="text-sm text-gray-500 truncate">{label}</p>
		<p class="text-2xl font-bold text-gray-800 leading-tight">{value}</p>
		{#if subtitle}
			<p class="text-xs text-gray-400 mt-0.5">{subtitle}</p>
		{/if}
		{#if trend}
			<p class="text-xs mt-1 {trend.value >= 0 ? 'text-green-600' : 'text-red-500'}">
				<i class="fa-solid {trend.value >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'} text-[10px]"></i>
				{Math.abs(trend.value)}% {trend.label ?? 'vs last month'}
			</p>
		{/if}
	</div>
</div>
