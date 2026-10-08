<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type Req = {
		request_id: string; document_name: string; student_name: string;
		student_code: string; program: string; status: string;
		purpose: string; date_requested: string; items: Array<{document_id:number;name:string}>;
	};

	let requests = $state(data.requests as Req[]);

	let search = $state('');
	let filterStatus = $state('');

	let deletingId = $state<string | null>(null);
	let expanded = $state<string[]>([]);
	function toggleItems(id: string) { expanded = expanded.includes(id) ? expanded.filter((item) => item !== id) : [...expanded, id]; }
	let deleteConfirmId = $state<string | null>(null);

	async function handleDelete(id: string) {
		deletingId = id;
		const res = await fetch('/api/requests', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ request_id: id })
		});
		if (res.ok) {
			requests = requests.filter(r => r.request_id !== id);
		}
		deletingId = null;
		deleteConfirmId = null;
	}

	const filtered = $derived(
		requests.filter(r => {
			const q = search.toLowerCase();
			const matchSearch = !q ||
				r.student_name.toLowerCase().includes(q) ||
				r.request_id.toLowerCase().includes(q) ||
				r.student_code?.toLowerCase().includes(q) ||
				(r.items ?? []).some((item) => item.name.toLowerCase().includes(q));
			const matchStatus = !filterStatus || r.status === filterStatus;
			return matchSearch && matchStatus;
		})
	);

	const statusCounts = $derived({
		pending: requests.filter(r => r.status === 'Pending').length,
		correction: requests.filter(r => r.status === 'Correction Requested').length,
		approved: requests.filter(r => r.status === 'Approved').length,
		rejected: requests.filter(r => r.status === 'Rejected').length,
	});
</script>

<div class="space-y-5">
	<!-- Stats -->
	<div class="ui-stat-grid grid grid-cols-2 xl:grid-cols-4 gap-4">
		<StatCard label="Pending" value={statusCounts.pending} icon="fa-solid fa-clock" color="orange" />
		<StatCard label="Correction Requested" value={statusCounts.correction} icon="fa-solid fa-rotate-left" color="gold" />
		<StatCard label="Approved" value={statusCounts.approved} icon="fa-solid fa-circle-check" color="green" />
		<StatCard label="Rejected" value={statusCounts.rejected} icon="fa-solid fa-circle-xmark" color="red" />
	</div>

	<!-- Filters -->
	<div class="flex flex-col sm:flex-row gap-3">
		<div class="relative flex-1">
			<i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
			<input
				bind:value={search}
				type="text"
				placeholder="Search by name, request ID or student ID..."
				class="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
			/>
		</div>
		<select bind:value={filterStatus} class="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30">
			<option value="">All Statuses</option>
			<option value="Pending">Pending</option>
			<option value="Correction Requested">Correction Requested</option>
			<option value="Approved">Approved</option>
			<option value="Rejected">Rejected</option>
		</select>
		{#if search || filterStatus}
			<button onclick={() => { search = ''; filterStatus = ''; }} class="px-3 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
				<i class="fa-solid fa-xmark mr-1"></i>Clear
			</button>
		{/if}
	</div>

	<!-- Table -->
	<div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
		<div class="px-5 py-4 border-b border-gray-100">
			<p class="text-sm text-gray-500">
				<span class="font-medium text-gray-800">{filtered.length}</span> requests found
			</p>
		</div>

		{#if filtered.length === 0}
			<EmptyState message="No requests found" icon="fa-solid fa-inbox" />
		{:else}
			<!-- Mobile card list -->
			<div class="md:hidden divide-y divide-gray-100">
				{#each filtered as req}
					<div class="p-4 space-y-2">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="font-medium text-gray-800 text-sm">{req.student_name}</p>
								<p class="text-xs text-gray-400">{req.student_code ?? '—'} · {req.program ?? '—'}</p>
							</div>
							<Badge value={req.status.toLowerCase()} />
						</div>
						<p class="text-sm text-gray-700">{req.document_name}{#if (req.items?.length ?? 0) > 1}<button type="button" class="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-essu-green" onclick={() => toggleItems(req.request_id)}>+{req.items.length - 1} more</button>{/if}</p>
						{#if expanded.includes(req.request_id)}<p class="mt-1 text-xs text-gray-500">{req.items.map((item) => item.name).join(', ')}</p>{/if}
						<div class="flex items-center justify-between gap-2 text-xs text-gray-400">
							<span class="font-mono">{req.request_id}</span>
							<span>{new Date(req.date_requested).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
						</div>
						<div class="flex items-center gap-2 pt-1">
							<a href="/staff/requests/{req.request_id}" class="text-xs px-2.5 py-1.5 bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors">
								<i class="fa-solid fa-eye mr-1"></i>Review
							</a>
							{#if deleteConfirmId === req.request_id}
								<button onclick={() => handleDelete(req.request_id)} disabled={deletingId === req.request_id} class="text-xs px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
									{deletingId === req.request_id ? 'Deleting…' : 'Confirm'}
								</button>
								<button onclick={() => deleteConfirmId = null} class="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700">Cancel</button>
							{:else}
								<button onclick={() => deleteConfirmId = req.request_id} class="text-xs px-2.5 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors" aria-label={`Delete request ${req.request_id}`}>
									<i class="fa-solid fa-trash"></i>
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
			<!-- Desktop table -->
			<div class="hidden md:block overflow-x-auto">
				<table class="w-full text-sm">
					<thead class="bg-gray-50 border-b border-gray-100">
						<tr>
							{#each ['Request ID', 'Student', 'Program', 'Document', 'Date', 'Status', ''] as col}
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{col}</th>
							{/each}
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-50">
						{#each filtered as req}
							<tr class="hover:bg-gray-50 transition-colors">
								<td class="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{req.request_id}</td>
								<td class="px-4 py-3 whitespace-nowrap">
									<p class="font-medium text-gray-800">{req.student_name}</p>
									<p class="text-xs text-gray-400">{req.student_code ?? '—'}</p>
								</td>
								<td class="px-4 py-3 text-gray-600">{req.program ?? '—'}</td>
								<td class="px-4 py-3 text-gray-700 whitespace-nowrap">{req.document_name}{#if (req.items?.length ?? 0) > 1}<button type="button" class="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-essu-green" onclick={() => toggleItems(req.request_id)}>+{req.items.length - 1} more</button>{/if}{#if expanded.includes(req.request_id)}<div class="mt-1 whitespace-normal text-xs text-gray-500">{req.items.map((item) => item.name).join(', ')}</div>{/if}</td>
								<td class="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
									{new Date(req.date_requested).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
								</td>
								<td class="px-4 py-3"><Badge value={req.status.toLowerCase()} /></td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-2">
										<a
											href="/staff/requests/{req.request_id}"
											class="text-xs px-2.5 py-1.5 bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors"
										>
											<i class="fa-solid fa-eye mr-1"></i>Review
										</a>
										{#if deleteConfirmId === req.request_id}
											<button
												onclick={() => handleDelete(req.request_id)}
												disabled={deletingId === req.request_id}
												class="text-xs px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
											>
												{deletingId === req.request_id ? 'Deleting…' : 'Confirm'}
											</button>
											<button
												onclick={() => deleteConfirmId = null}
												class="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700"
											>Cancel</button>
										{:else}
											<button
												onclick={() => deleteConfirmId = req.request_id}
												class="text-xs px-2.5 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
												aria-label={`Delete request ${req.request_id}`}
											>
												<i class="fa-solid fa-trash"></i>
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
