<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';

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

<div class="ui-filter-bar">
	<label class="ui-filter-search">
		<span class="sr-only">Search</span>
		<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
		<input
			type="search"
			value={searchValue}
			placeholder={searchPlaceholder}
			oninput={(e) => onSearch?.((e.target as HTMLInputElement).value)}
		/>
	</label>

	{#each filters as filter}
		<select
			value={filterValues[filter.key] ?? ''}
			aria-label={filter.placeholder}
			onchange={(e) => onFilterChange?.(filter.key, (e.target as HTMLSelectElement).value)}
		>
			<option value="">{filter.placeholder}</option>
			{#each filter.options as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	{/each}

	{#if extra}
		{@render extra()}
	{/if}

	{#if onReset}
		<Button type="button" variant="ghost" size="sm" icon="fa-solid fa-rotate-left" onclick={onReset}>Reset</Button>
	{/if}
</div>

<style>
	.ui-filter-bar { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr); gap: var(--space-3); align-items: end; padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); box-shadow: var(--shadow-card); }
	.ui-filter-search { position: relative; display: flex; min-width: 0; align-items: center; }
	.ui-filter-search > i { position: absolute; left: var(--space-3); color: var(--color-text-muted); pointer-events: none; }
	.ui-filter-search input, .ui-filter-bar select { width: 100%; min-width: 0; height: var(--control-height-touch); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); padding: 0 var(--space-3); color: var(--color-text); font: inherit; font-size: var(--font-size-input); }
	.ui-filter-search input { padding-left: 40px; }
	.ui-filter-search input:focus-visible, .ui-filter-bar select:focus-visible { border-color: var(--color-primary); outline: 2px solid var(--color-primary); outline-offset: 2px; box-shadow: var(--focus-ring); }
	@media (min-width: 640px) {
		.ui-filter-bar { display: flex; flex-wrap: wrap; padding: var(--space-4); }
		.ui-filter-search { flex: 1 1 16rem; }
		.ui-filter-bar select { flex: 0 1 14rem; }
	}
</style>
