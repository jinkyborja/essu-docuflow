<script lang="ts">
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type Row = { request_id: string; status: string; date_requested: string; document_name: string };

	let timeRange = $state('all');

	const now = new Date();
	const filtered = $derived(() => {
		const rows = data.requests as Row[];
		if (timeRange === 'all') return rows;
		const cutoff = new Date();
		if (timeRange === 'month')   cutoff.setMonth(now.getMonth() - 1);
		if (timeRange === 'quarter') cutoff.setMonth(now.getMonth() - 3);
		if (timeRange === 'year')    cutoff.setFullYear(now.getFullYear() - 1);
		return rows.filter(r => new Date(r.date_requested) >= cutoff);
	});

	const total    = $derived(filtered().length);
	const approved = $derived(filtered().filter(r => r.status === 'Approved').length);
	const rejected = $derived(filtered().filter(r => r.status === 'Rejected').length);
	const pending  = $derived(filtered().filter(r => r.status === 'Pending').length);

	type DocStat = { document_name: string; total: number; approved: number; rejected: number };
	const docStats = $derived(() => {
		if (timeRange === 'all') return data.docStats as DocStat[];
		// Recompute from filtered rows
		const map = new Map<string, DocStat>();
		for (const r of filtered()) {
			const existing = map.get(r.document_name) ?? { document_name: r.document_name, total: 0, approved: 0, rejected: 0 };
			existing.total++;
			if (r.status === 'Approved') existing.approved++;
			if (r.status === 'Rejected') existing.rejected++;
			map.set(r.document_name, existing);
		}
		return [...map.values()].sort((a, b) => b.total - a.total);
	});
</script>

<div class="space-y-5">
	<!-- Controls -->
	<div class="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3 justify-between">
		<select bind:value={timeRange} class="py-2 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30">
			<option value="all">All Time</option>
			<option value="month">Last Month</option>
			<option value="quarter">Last Quarter</option>
			<option value="year">Last Year</option>
		</select>
		<div class="flex items-center gap-2">
			<button onclick={() => window.print()} class="flex items-center gap-1.5 text-sm px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
				<i class="fa-solid fa-print"></i> Print
			</button>
		</div>
	</div>

	<!-- Summary cards -->
	<div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
		<StatCard label="Total Requests" value={total}    icon="fa-solid fa-file-lines"    color="blue"   />
		<StatCard label="Approved"        value={approved} icon="fa-solid fa-circle-check"  color="green"  />
		<StatCard label="Rejected"        value={rejected} icon="fa-solid fa-circle-xmark"  color="red"    />
		<StatCard label="Pending"         value={pending}  icon="fa-solid fa-clock"          color="orange" />
	</div>

	<!-- Document Type Stats -->
	<div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
		<div class="px-5 py-4 border-b border-gray-100">
			<h3 class="font-semibold text-gray-800">Requests by Document Type</h3>
		</div>
		{#if docStats().length === 0}
			<EmptyState message="No data for selected period" icon="fa-solid fa-chart-simple" />
		{:else}
			<div class="p-5 space-y-4">
				{#each docStats() as stat}
					<div class="flex items-center gap-3">
						<p class="text-sm text-gray-600 truncate w-40 shrink-0">{stat.document_name}</p>
						<div class="flex-1 bg-gray-100 rounded-full h-2">
							<div class="bg-essu-green h-2 rounded-full transition-all"
								style="width: {total > 0 ? (stat.total / total) * 100 : 0}%"></div>
						</div>
						<div class="flex items-center gap-3 shrink-0 text-xs text-gray-500">
							<span class="font-semibold text-gray-700 w-4 text-right">{stat.total}</span>
							<span class="text-green-600">{stat.approved} approved</span>
							<span class="text-red-500">{stat.rejected} rejected</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Status Breakdown -->
	<div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
		<div class="px-5 py-4 border-b border-gray-100">
			<h3 class="font-semibold text-gray-800">Status Breakdown</h3>
		</div>
		<div class="grid grid-cols-2 xl:grid-cols-4 gap-4 p-5">
			{#each [
				{ label: 'Approved',             count: approved, pct: total > 0 ? Math.round(approved/total*100) : 0, color: 'text-green-600 bg-green-50'  },
				{ label: 'Rejected',             count: rejected, pct: total > 0 ? Math.round(rejected/total*100) : 0, color: 'text-red-500 bg-red-50'     },
				{ label: 'Pending',              count: pending,  pct: total > 0 ? Math.round(pending/total*100)  : 0, color: 'text-orange-600 bg-orange-50'},
				{ label: 'Correction Requested', count: filtered().filter(r => r.status === 'Correction Requested').length,
				  pct: total > 0 ? Math.round(filtered().filter(r => r.status === 'Correction Requested').length/total*100) : 0,
				  color: 'text-yellow-600 bg-yellow-50' }
			] as s}
				<div class="p-4 rounded-xl {s.color.split(' ')[1]} border border-gray-100 text-center">
					<p class="text-2xl font-bold text-gray-800">{s.count}</p>
					<p class="text-xs text-gray-500 mt-0.5">{s.label}</p>
					<p class="text-xs font-semibold {s.color.split(' ')[0]} mt-1">{s.pct}%</p>
				</div>
			{/each}
		</div>
	</div>
</div>
