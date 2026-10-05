<script lang="ts">
	import type { Snippet } from 'svelte';

	interface FilterOption {
		value: string;
		label: string;
	}

	interface FilterSelect {
		key: string;
		placeholder: string;
		options: FilterOption[];
	}

	interface Props {
		searchPlaceholder?: string;
		searchValue?: string;
		filters?: FilterSelect[];
		filterValues?: Record<string, string>;
		onSearch?: (value: string) => void;
		onFilterChange?: (key: string, value: string) => void;
		onReset?: () => void;
		extra?: Snippet;
	}

	const {
		searchPlaceholder = 'Search...',
		searchValue = '',
		filters = [],
		filterValues = {},
		onSearch,
		onFilterChange,
		onReset,
		extra
	}: Props = $props();
</script>

<div class="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end">
	<!-- Search -->
	<div class="relative flex-1 min-w-48">
		<i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
		<input
			type="text"
			value={searchValue}
			placeholder={searchPlaceholder}
			oninput={(e) => onSearch?.((e.target as HTMLInputElement).value)}
			class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light transition"
		/>
	</div>

	<!-- Filter selects -->
	{#each filters as filter}
		<select
			value={filterValues[filter.key] ?? ''}
			onchange={(e) => onFilterChange?.(filter.key, (e.target as HTMLSelectElement).value)}
			class="py-2 px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light transition"
		>
			<option value="">{filter.placeholder}</option>
			{#each filter.options as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	{/each}

	<!-- Extra slot (e.g., checkboxes) -->
	{#if extra}
		{@render extra()}
	{/if}

	<!-- Reset -->
	{#if onReset}
		<button
			onclick={onReset}
			class="py-2 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
		>
			<i class="fa-solid fa-rotate-left text-xs"></i>
			Reset
		</button>
	{/if}
</div>
