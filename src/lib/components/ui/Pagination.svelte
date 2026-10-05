<script lang="ts">
	interface Props {
		totalItems: number;
		itemsPerPage: number;
		currentPage: number;
		onPageChange: (page: number) => void;
		onItemsPerPageChange?: (n: number) => void;
		pageSizeOptions?: number[];
	}

	const {
		totalItems,
		itemsPerPage,
		currentPage,
		onPageChange,
		onItemsPerPageChange,
		pageSizeOptions = [10, 25, 50]
	}: Props = $props();

	const totalPages = $derived(Math.ceil(totalItems / itemsPerPage));
	const start = $derived((currentPage - 1) * itemsPerPage + 1);
	const end = $derived(Math.min(currentPage * itemsPerPage, totalItems));

	const pages = $derived(() => {
		const range: (number | '...')[] = [];
		if (totalPages <= 7) {
			for (let i = 1; i <= totalPages; i++) range.push(i);
		} else {
			range.push(1);
			if (currentPage > 3) range.push('...');
			for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
				range.push(i);
			}
			if (currentPage < totalPages - 2) range.push('...');
			range.push(totalPages);
		}
		return range;
	});
</script>

<div class="flex items-center justify-between px-1 py-2 flex-wrap gap-3">
	<div class="flex items-center gap-3">
		<p class="text-sm text-gray-500">
			{#if totalItems === 0}
				No results
			{:else}
				Showing <span class="font-medium text-gray-700">{start}–{end}</span> of
				<span class="font-medium text-gray-700">{totalItems}</span>
			{/if}
		</p>
		{#if onItemsPerPageChange}
			<select
				value={itemsPerPage}
				onchange={(e) => onItemsPerPageChange(Number((e.target as HTMLSelectElement).value))}
				class="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-essu-green/30"
			>
				{#each pageSizeOptions as n}
					<option value={n}>{n} / page</option>
				{/each}
			</select>
		{/if}
	</div>

	<div class="flex items-center gap-1">
		<button
			onclick={() => onPageChange(currentPage - 1)}
			disabled={currentPage <= 1}
			class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
			aria-label="Previous page"
		>
			<i class="fa-solid fa-chevron-left text-xs"></i>
		</button>

		{#each pages() as page}
			{#if page === '...'}
				<span class="px-2 text-gray-400 text-sm">…</span>
			{:else}
				<button
					onclick={() => onPageChange(page as number)}
					class="w-8 h-8 rounded-lg text-sm font-medium transition-colors
						{currentPage === page
							? 'bg-essu-green text-white'
							: 'text-gray-600 hover:bg-gray-100'}"
				>
					{page}
				</button>
			{/if}
		{/each}

		<button
			onclick={() => onPageChange(currentPage + 1)}
			disabled={currentPage >= totalPages}
			class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
			aria-label="Next page"
		>
			<i class="fa-solid fa-chevron-right text-xs"></i>
		</button>
	</div>
</div>
