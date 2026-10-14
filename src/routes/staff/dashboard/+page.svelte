<script lang="ts">
	import { formatName, pluralize } from '$lib/formatting';
	import { requestStatusKey, statusLabel, STATUS_COLORS } from '$lib/request-status';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { fetchAdminRequests, recentActivity, type AdminRequest } from '$lib/admin-requests';
	import { showToast } from '$lib/stores/toasts';

	const { data }: { data: PageData } = $props();
	let submittedRequests = $state<AdminRequest[] | null>(null);
	const activity = $derived(recentActivity(data.recentActivity, submittedRequests ?? data.pendingQueue as unknown as AdminRequest[]));
	onMount(() => { void fetchAdminRequests().then(requests => { submittedRequests = requests; }).catch(error => showToast(error.message, 'error')); });

	const activityIcons: Record<string, string> = {
		pending: 'fa-solid fa-clock', correction_requested: 'fa-solid fa-rotate-left',
		approved: 'fa-solid fa-circle-check', processing: 'fa-solid fa-gears',
		ready_for_pickup: 'fa-solid fa-box', released: 'fa-solid fa-handshake',
		rejected: 'fa-solid fa-circle-xmark', cancelled: 'fa-solid fa-ban'
	};
</script>

<style>
	@media (max-width: 640px) {
		.staff-dashboard-page :global(.ui-stat-grid) {
			display: grid !important;
			grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
			gap: 1rem;
		}

		.staff-dashboard-page :global(.ui-stat-grid > *) {
			display: block;
			width: 100%;
			min-width: 0;
		}

		.staff-dashboard-page :global(.ui-stat-card) {
			width: 100%;
			min-width: 0;
			min-height: 106px;
			padding: 1rem !important;
			flex-direction: row;
			align-items: center;
			gap: 0.75rem !important;
		}

		.staff-dashboard-page :global(.ui-stat-card > div:first-child) {
			width: 2.5rem;
			height: 2.5rem;
			margin-top: 0;
		}

		.staff-dashboard-page :global(.ui-stat-card > div:last-child > p:first-child) {
			font-size: 0.8rem;
		}

		.staff-dashboard-page :global(.ui-stat-card > div:last-child > p:nth-child(2)) {
			font-size: 1.25rem;
		}

		.dashboard-activity-title {
			display: -webkit-box;
			overflow: hidden;
			white-space: normal;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
		}

		.dashboard-quick-links {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.5rem;
		}

		.dashboard-quick-links > a {
			min-width: 0;
			width: 100%;
			box-sizing: border-box;
			margin-block-start: 0;
			flex-direction: column;
			justify-content: center;
			gap: 0.5rem;
			text-align: center;
		}
	}
</style>

<div class="staff-dashboard-page space-y-6">
	<!-- Stats -->
	<div class="ui-stat-grid grid grid-cols-1 min-[360px]:grid-cols-2 xl:grid-cols-4 gap-4">
		<a href="/staff/students" class="rounded-xl focus:outline-none focus:ring-2 focus:ring-essu-green/30"><StatCard label="Total Students"   value={data.counts.students} icon="fa-solid fa-users"         color="blue"   /></a>
		<a href="/staff/requests" class="rounded-xl focus:outline-none focus:ring-2 focus:ring-essu-green/30"><StatCard label="Total Requests"   value={data.counts.requests} icon="fa-solid fa-file-lines"    color="teal"   /></a>
		<a href="/staff/requests?status=Pending" class="rounded-xl focus:outline-none focus:ring-2 focus:ring-essu-green/30"><StatCard label="Pending Requests" value={data.counts.pending}  icon="fa-solid fa-clock"         color="orange" /></a>
		<a href="/staff/requests?status=Approved" class="rounded-xl focus:outline-none focus:ring-2 focus:ring-essu-green/30"><StatCard label="Approved"         value={data.counts.approved} icon="fa-solid fa-circle-check"  color="green"  /></a>
	</div>
	{#if data.role === 'Admin'}
		<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 {data.counts.pendingVerification > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-gray-200 bg-gray-50 text-gray-600'}">
			<span class="font-semibold">Student IDs awaiting office verification</span><div class="flex items-center gap-3"><span class="rounded-full px-3 py-1 text-sm font-bold {data.counts.pendingVerification > 0 ? 'bg-amber-200' : 'bg-gray-200'}">{data.counts.pendingVerification}</span><Button href="/staff/students?status=pending" variant={data.counts.pendingVerification > 0 ? 'primary' : 'secondary'} size="sm">Review now</Button></div>
		</div>
	{/if}

<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		<a href="/staff/requests?status=Approved&amp;delivery=waiting" class="rounded-xl border border-essu-green/20 bg-white p-4 text-sm text-essu-green focus:outline-none focus:ring-2 focus:ring-essu-green/30"><strong>{data.counts.awaitingDelivery} {pluralize(data.counts.awaitingDelivery, 'request')} ready for release</strong><span class="block mt-1 text-xs text-gray-500">Open a request and mark it released after the student collects the document.</span></a>
		<a href="/staff/requests?status=Correction%20Requested" class="rounded-xl border border-amber-200 bg-white p-4 text-sm text-amber-800 focus:outline-none focus:ring-2 focus:ring-essu-green/30"><strong>{data.counts.awaitingCorrections} {pluralize(data.counts.awaitingCorrections, 'request')} awaiting student corrections</strong><span class="block mt-1 text-xs text-gray-500">Review outstanding corrections and office messages.</span></a>
	</div>
	<div class="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
		<!-- Requests needing office action -->
		<div class="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
				<div>
					<h2 class="font-semibold text-gray-800">Needs action</h2>
					<p class="text-xs text-gray-400 mt-0.5">{data.pendingQueue.length} {pluralize(data.pendingQueue.length, 'request')} awaiting action</p>
				</div>
				<a href="/staff/requests" class="text-sm text-essu-green font-medium hover:underline flex items-center gap-1">
					View all <i class="fa-solid fa-arrow-right text-xs"></i>
				</a>
			</div>

			{#if data.pendingQueue.length === 0}
				<EmptyState message="No requests need action" description="You’re up to date. View all requests to check their progress." icon="fa-solid fa-inbox" /><div class="flex justify-center pb-6"><Button variant="secondary" href="/staff/requests">View requests</Button></div>
			{:else}
				<div class="md:hidden divide-y divide-gray-100">
					{#each data.pendingQueue as req}
						<article class="p-4 space-y-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0"><p class="text-sm font-semibold">{formatName(req.first_name, req.middle_name, req.last_name)}</p><p class="text-xs text-gray-500 mt-1">{req.request_id}</p></div>
								<Button href={'/staff/requests/' + req.request_id} size="sm" icon="fa-solid fa-eye">Review</Button>
							</div>
							<p class="text-sm text-gray-600">{req.document_name}</p>
							<Badge value={req.status as string} size="sm" />
						</article>
					{/each}
				</div>
				<div class="admin-table-wrap hidden md:block">
					<table class="admin-table admin-table--queue">
						<colgroup>
							<col class="queue-col-id" />
							<col class="queue-col-student" />
							<col class="queue-col-document" />
							<col class="queue-col-date" />
							<col class="queue-col-actions" />
						</colgroup>
						<thead class="bg-gray-50 border-b border-gray-100">
							<tr>
								<th scope="col">Request ID</th>
								<th scope="col">Student</th>
								<th scope="col">Document</th>
								<th scope="col">Date</th>
								<th scope="col" class="actions-header">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-50">
							{#each data.pendingQueue as req}
								<tr>
									<td class="queue-id">{req.request_id}</td>
									<td class="queue-student">
										<p class="font-medium text-gray-800">{formatName(req.first_name, req.middle_name, req.last_name)}</p>
										<p class="text-xs text-gray-400">{req.student_id ?? '—'}{req.program ? ' · ' + req.program : ''}</p>
									</td>
									<td class="queue-document">{req.document_name}</td>
									<td class="queue-date">
										{new Date(req.date_requested as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
									</td>
									<td class="actions-cell">
										<Button href={'/staff/requests/' + req.request_id} size="sm" icon="fa-solid fa-eye">Review</Button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Right column -->
		<div class="space-y-4">
			<!-- Recent Activity -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="px-5 py-4 border-b border-gray-100">
					<h2 class="font-semibold text-gray-800">Recent Activity</h2>
				</div>
				{#if activity.length === 0}
					<div class="py-6 text-center"><p class="mb-3 text-sm text-gray-600">No recent activity</p><Button variant="secondary" href="/staff/requests">View requests</Button></div>
				{:else}
					<div class="divide-y divide-gray-50">
						{#each activity as item}
							{@const status = requestStatusKey(item.new_status as string)}
							{@const color = status ? STATUS_COLORS[status].color : '#64748b'}
							<div class="flex items-start gap-3 px-5 py-3">
								<div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={`color:${color};background:${color}18`}>
									<i class="{item.new_status === 'Request submitted' ? 'fa-solid fa-file-circle-plus' : activityIcons[status ?? ''] ?? 'fa-solid fa-gear'} text-xs" aria-hidden="true"></i>
								</div>
								<div class="min-w-0">
									<p class="dashboard-activity-title text-sm font-medium text-gray-700 leading-tight truncate">
										{item.document_name}: {item.new_status === 'Request submitted' ? 'Request submitted' : statusLabel(item.new_status as string)}
									</p>
									<p class="text-xs text-gray-400 mt-0.5">
										{formatName(item.first_name, item.middle_name, item.last_name)} ·
										{new Date(item.changed_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
									</p>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Quick Links -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
				<h2 class="font-semibold text-gray-800 mb-3">Quick Links</h2>
				<div class="dashboard-quick-links space-y-1">
					{#each [
						{ href: '/staff/requests', icon: 'fa-solid fa-inbox', label: 'All Requests', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
						{ href: '/staff/documents', icon: 'fa-solid fa-folder-open', label: 'Manage Documents', color: 'text-green-600 bg-green-50 hover:bg-green-100' },
						{ href: '/staff/students', icon: 'fa-solid fa-users', label: 'Manage Students', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
						{ href: '/staff/reports', icon: 'fa-solid fa-chart-simple', label: 'View Reports', color: 'text-teal-600 bg-teal-50 hover:bg-teal-100' }
					] as link}
						<a href={link.href}
							class="{link.color} flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium">
							<i class="{link.icon} w-4 text-center"></i>
							{link.label}
						</a>
					{/each}
				</div>
			</div>

		</div>
	</div>
</div>
