<script lang="ts">
	import { formatDate } from '$lib/request-flow';
	import { formatName, pluralize } from '$lib/formatting';
	import { statusLabel, requestStatusKey } from '$lib/request-status';
	import Button from '$lib/components/ui/Button.svelte';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import DocumentPopover from '$lib/components/ui/DocumentPopover.svelte';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';
	const { data }: { data: PageData } = $props();
	type Req = { completed_at?: string | null; request_id: string; document_name: string; student_name: string; first_name?: string; middle_name?: string; last_name?: string; student_code: string; program: string; status: string; date_requested: string; items: Array<{document_id: number; name: string}>; decision_recorded?: boolean; decision_actor_key?: string; decision_actor_name?: string; decision_actor_role?: string };
	let requests = $state(data.requests as Req[]);
	let search = $state(''), filterStatus = $state(data.initialStatus ?? ''), deliveryWaiting = $state(!!data.deliveryWaiting), decidedBy = $state(data.isAdmin ? data.initialDecider : '');
	$effect(() => { requests = data.requests as Req[]; filterStatus = data.initialStatus ?? ''; deliveryWaiting = !!data.deliveryWaiting; decidedBy = data.isAdmin ? data.initialDecider : ''; });
	const menuItems = [{label: 'Cancel request', danger: true, disabled: true, reason: 'Not available yet'}, {label: 'Archive', disabled: true, reason: 'Not available yet'}];
	const kpis = [{status: 'Pending', key: 'pending', icon: 'fa-solid fa-clock', color: 'orange'}, {status: 'Correction Requested', key: 'correction_requested', icon: 'fa-solid fa-rotate-left', color: 'gold'}, {status: 'Approved', key: 'approved', icon: 'fa-solid fa-circle-check', color: 'green'}, {status: 'Rejected', key: 'rejected', icon: 'fa-solid fa-circle-xmark', color: 'red'}] as const;
	const deciderOptions = $derived([...new Map(requests.filter(req => req.decision_recorded && req.decision_actor_key).map(req => [req.decision_actor_key!, {id: req.decision_actor_key!, name: req.decision_actor_name ?? 'Former staff', role: req.decision_actor_role ?? 'Staff'}] as const)).values()].sort((a, b) => a.name.localeCompare(b.name)));
	function toggleStatus(status: string) { filterStatus = filterStatus === status ? '' : status; if (filterStatus !== 'Approved') deliveryWaiting = false; }
	function toggleDelivery() { deliveryWaiting = !deliveryWaiting; if (deliveryWaiting) filterStatus = 'Approved'; }
	function person(req: Req) { return formatName(req.first_name, req.middle_name, req.last_name) || req.student_name; }
	function decisionAttribution(req: Req) {
		if (req.decision_recorded) return `by ${req.decision_actor_name || 'Former staff'} - ${req.decision_actor_role || 'Staff'}`;
		return requestStatusKey(req.status) === 'pending' ? '' : 'Not recorded';
	}
	const filtered = $derived(requests.filter(req => {
		const q = search.trim().toLowerCase();
		return (!q || person(req).toLowerCase().includes(q) || req.request_id.toLowerCase().includes(q) || req.student_code?.toLowerCase().includes(q) || req.items?.some(item => item.name.toLowerCase().includes(q))) &&
			(!filterStatus || requestStatusKey(req.status) === requestStatusKey(filterStatus)) &&
			(!data.isAdmin || !decidedBy || req.decision_actor_key === decidedBy) &&
			(!deliveryWaiting || (requestStatusKey(req.status) === 'approved' && !req.completed_at));
	}));
</script>
<div class="space-y-5">
	<div class="ui-stat-grid grid grid-cols-2 xl:grid-cols-4 gap-4">
		{#each kpis as kpi}<button type="button" aria-pressed={filterStatus === kpi.status} title={'Filter ' + statusLabel(kpi.status) + ' requests'} onclick={() => toggleStatus(kpi.status)} class="rounded-xl border-2 text-left focus:outline-none focus:ring-2 focus:ring-essu-green/30 {filterStatus === kpi.status ? 'border-essu-green' : 'border-transparent'}"><StatCard label={statusLabel(kpi.status)} value={requests.filter(req => requestStatusKey(req.status) === kpi.key).length} icon={kpi.icon} color={kpi.color} /></button>{/each}
	</div>
	<div class="staff-filter-bar flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
		<label class="relative min-w-0 flex-1"><span class="sr-only">Search requests</span><i aria-hidden="true" class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-gray-400 text-sm"></i><input bind:value={search} type="search" placeholder="Search by name, request ID or student ID..." class="min-h-11 w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" /></label>
		<select aria-label="Request status" bind:value={filterStatus} class="min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"><option value="">All statuses</option>{#each kpis as kpi}<option value={kpi.status}>{statusLabel(kpi.status)}</option>{/each}</select>
		{#if data.isAdmin}<select aria-label="Decided by" bind:value={decidedBy} class="min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"><option value="">All decision makers</option>{#each deciderOptions as option}<option value={option.id}>{option.name} - {option.role}</option>{/each}</select>{/if}
		<button type="button" aria-pressed={deliveryWaiting} title="Approved requests ready for pickup" onclick={toggleDelivery} class="min-h-11 rounded-full border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 {deliveryWaiting ? 'border-essu-green bg-essu-green/10 text-essu-green' : 'border-gray-200 bg-white text-gray-600'}"><i class="fa-solid fa-truck mr-1.5" aria-hidden="true"></i>Ready for pickup</button>
		{#if search || filterStatus || deliveryWaiting || decidedBy}<Button variant="ghost" onclick={() => { search = ''; filterStatus = ''; deliveryWaiting = false; decidedBy = ''; }}>Clear</Button>{/if}
	</div>
	<div class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
		<p class="border-b border-gray-100 px-5 py-4 text-sm text-gray-500" aria-live="polite"><span class="font-medium text-gray-800">{filtered.length}</span> {pluralize(filtered.length, 'request')} found</p>
		{#if !filtered.length}<EmptyState message="No requests found" description="Try another search or clear the filters to see all requests." icon="fa-solid fa-inbox" /><div class="flex justify-center pb-6"><Button variant="secondary" onclick={() => { search = ''; filterStatus = ''; deliveryWaiting = false; decidedBy = ''; }}>Clear filters</Button></div>
		{:else}
			<div class="divide-y divide-gray-100 xl:hidden">
				{#each filtered as req}<article class="space-y-3 p-4"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-sm font-medium text-gray-800">{person(req)}</p><p class="text-xs text-gray-500">{req.student_code ?? '—'} · {req.program ?? '—'}</p></div><div class="text-right"><StatusChip value={req.status} />{#if decisionAttribution(req)}<p class="mt-1 text-xs text-gray-400">{decisionAttribution(req)}</p>{/if}</div></div><div class="text-sm">{req.items?.[0]?.name ?? req.document_name}<DocumentPopover items={req.items ?? []} /></div><div class="flex justify-between text-xs text-gray-500"><span class="font-mono">{req.request_id}</span><span>{formatDate(req.date_requested)}</span></div><div class="flex flex-nowrap items-center gap-2"><Button size="sm" href={'/staff/requests/' + req.request_id} icon="fa-solid fa-eye">Review</Button><RowMenu items={menuItems} label={'Actions for request ' + req.request_id} /></div></article>{/each}
			</div>
			<div class="admin-table-wrap request-table-wrap hidden xl:block">
				<table class="admin-table admin-table--requests">
					<colgroup>
						<col class="request-col-id" />
						<col class="request-col-student" />
						<col class="request-col-program" />
						<col class="request-col-document" />
						<col class="request-col-date" />
						<col class="request-col-status" />
						<col class="request-col-actions" />
					</colgroup>
					<thead>
						<tr>
							<th scope="col">Request ID</th>
							<th scope="col">Student</th>
							<th scope="col">Program</th>
							<th scope="col">Document</th>
							<th scope="col">Date</th>
							<th scope="col">Status</th>
							<th scope="col" class="actions-header">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as req}
							<tr>
								<td class="request-id">{req.request_id}</td>
								<td><div><p class="request-student-name">{person(req)}</p><p class="request-student-id">{req.student_code ?? '—'}</p></div></td>
								<td><span class="program-value" title={req.program ?? ''}>{req.program ?? '—'}</span></td>
								<td>{req.items?.[0]?.name ?? req.document_name}<DocumentPopover items={req.items ?? []} /></td>
								<td class="request-date">{new Date(req.date_requested).toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila'})}</td>
								<td><div class="request-status-stack"><StatusChip value={req.status} />{#if decisionAttribution(req)}<p class="decision-attribution">{decisionAttribution(req)}</p>{/if}</div></td>
								<td class="actions-cell"><div class="action-buttons"><Button size="sm" href={'/staff/requests/' + req.request_id} icon="fa-solid fa-eye">Review</Button><RowMenu items={menuItems} label={'Actions for request ' + req.request_id} /></div></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
