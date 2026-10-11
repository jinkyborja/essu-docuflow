<script lang="ts">
	import { formatName, pluralize } from '$lib/formatting';
	import { requestStatusKey, statusLabel, STATUS_COLORS } from '$lib/request-status';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	const activityIcons: Record<string, string> = {
		pending: 'fa-solid fa-clock', correction_requested: 'fa-solid fa-rotate-left',
		approved: 'fa-solid fa-circle-check', processing: 'fa-solid fa-gears',
		ready_for_pickup: 'fa-solid fa-box', released: 'fa-solid fa-handshake',
		rejected: 'fa-solid fa-circle-xmark', cancelled: 'fa-solid fa-ban'
	};
</script>

<div class="space-y-6">
	<!-- Stats -->
	<div class="ui-stat-grid grid grid-cols-2 xl:grid-cols-4 gap-4">
		<a href="/staff/students" class="rounded-xl focus:outline-none focus:ring-2 focus:ring-essu-green/30"><StatCard label="Total Students"   value={data.counts.students} icon="fa-solid fa-users"         color="blue"   /></a>
		<a href="/staff/requests" class="rounded-xl focus:outline-none focus:ring-2 focus:ring-essu-green/30"><StatCard label="Total Requests"   value={data.counts.requests} icon="fa-solid fa-file-lines"    color="teal"   /></a>
		<a href="/staff/requests?status=Pending" class="rounded-xl focus:outline-none focus:ring-2 focus:ring-essu-green/30"><StatCard label="Pending Requests" value={data.counts.pending}  icon="fa-solid fa-clock"         color="orange" /></a>
		<a href="/staff/requests?status=Approved" class="rounded-xl focus:outline-none focus:ring-2 focus:ring-essu-green/30"><StatCard label="Approved"         value={data.counts.approved} icon="fa-solid fa-circle-check"  color="green"  /></a>
	</div>
	{#if data.role === 'Admin'}
		<a href="/staff/students?status=pending" class="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 hover:bg-amber-100">
			<span class="font-semibold">Student IDs awaiting office verification</span><span class="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold">{data.counts.pendingVerification}</span>
		</a>
	{/if}

<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		<a href="/staff/requests?status=Approved&amp;delivery=waiting" class="rounded-xl border border-essu-green/20 bg-white p-4 text-sm text-essu-green focus:outline-none focus:ring-2 focus:ring-essu-green/30"><strong>{data.counts.awaitingDelivery} approved {pluralize(data.counts.awaitingDelivery, 'request')} awaiting delivery confirmation</strong><span class="block mt-1 text-xs text-gray-500">Open a request and record delivery only after the student receives the document.</span></a>
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
				<EmptyState message="No requests need action" icon="fa-solid fa-inbox" />
			{:else}
				<div class="md:hidden divide-y divide-gray-100">
					{#each data.pendingQueue as req}
						<article class="p-4 space-y-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0"><p class="text-sm font-semibold">{formatName(req.first_name, req.middle_name, req.last_name)}</p><p class="text-xs text-gray-500 mt-1">{req.request_id}</p></div>
								<a href="/staff/requests/{req.request_id}" class="page-primary-action">{req.action_needed} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
							</div>
							<p class="text-sm text-gray-600">{req.document_name}</p>
							<Badge value={req.status as string} size="sm" />
						</article>
					{/each}
				</div>
				<div class="hidden md:block overflow-x-auto">
					<table class="office-queue-table w-full text-sm">
						<thead class="bg-gray-50 border-b border-gray-100">
							<tr>
								{#each ['Request ID', 'Student', 'Document', 'Date', 'Action'] as col}
									<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{col}</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-50">
							{#each data.pendingQueue as req}
								<tr class="hover:bg-gray-50 transition-colors">
									<td class="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{req.request_id}</td>
									<td class="px-4 py-3 whitespace-nowrap">
										<p class="font-medium text-gray-800">{formatName(req.first_name, req.middle_name, req.last_name)}</p>
										<p class="text-xs text-gray-400">{req.student_id ?? '—'}{req.program ? ' · ' + req.program : ''}</p>
									</td>
									<td class="px-4 py-3 text-gray-600 whitespace-nowrap">{req.document_name}</td>
									<td class="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
										{new Date(req.date_requested as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
									</td>
									<td class="px-4 py-3">
										<a href="/staff/requests/{req.request_id}"
											class="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors">
											<i class="fa-solid fa-eye text-[10px]"></i> {req.action_needed}
										</a>
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
				{#if data.recentActivity.length === 0}
					<p class="text-sm text-gray-400 text-center py-6">No recent activity</p>
				{:else}
					<div class="divide-y divide-gray-50">
						{#each data.recentActivity as item}
							{@const status = requestStatusKey(item.new_status as string)}
							{@const color = status ? STATUS_COLORS[status].color : '#64748b'}
							<div class="flex items-start gap-3 px-5 py-3">
								<div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={`color:${color};background:${color}18`}>
									<i class="{activityIcons[status ?? ''] ?? 'fa-solid fa-gear'} text-xs"></i>
								</div>
								<div class="min-w-0">
									<p class="text-sm font-medium text-gray-700 leading-tight truncate">
										{item.document_name}: {statusLabel(item.new_status as string)}
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
				<div class="space-y-1">
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
