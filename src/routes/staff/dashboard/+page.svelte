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
	.staff-dashboard-page { display: grid; gap: 0.75rem; }
	.dashboard-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; }
	.dashboard-stat-link { display: block; min-width: 0; color: inherit; text-decoration: none; }
	.dashboard-stat-link:focus-visible { border-radius: var(--radius-card); }
	.staff-dashboard-page :global(.ui-stat-card) {
		min-width: 0;
		min-height: 5rem;
		align-items: center;
		flex-direction: row !important;
		gap: 0.625rem !important;
		padding: 0.625rem !important;
	}
	.staff-dashboard-page :global(.ui-stat-card .stat-icon) { width: 2.5rem; height: 2.5rem; border-radius: 0.625rem; }
	.staff-dashboard-page :global(.ui-stat-card .stat-icon i) { font-size: 1rem; }
	.staff-dashboard-page :global(.ui-stat-card > div:nth-child(2) > p:first-child) { font-size: 0.7rem; line-height: 1.25; }
	.staff-dashboard-page :global(.ui-stat-card > div:nth-child(2) > p:nth-child(2)) { font-size: 1.25rem; line-height: 1.2; }
	.staff-dashboard-page :global(.ui-stat-card > div:nth-child(2) > p:nth-child(3)) { font-size: 0.65rem; }
	.staff-dashboard-page :global(.ui-stat-card .stat-action-indicator) { font-size: 0.65rem; }
	.dashboard-verification-card {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 12%, var(--color-border));
		border-radius: var(--radius-card);
		background: linear-gradient(105deg, color-mix(in srgb, var(--color-primary-soft) 76%, var(--color-surface)), var(--color-surface));
		color: var(--color-text);
	}
	.dashboard-verification-icon {
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 0.625rem;
		background: var(--color-primary-soft);
		color: var(--color-primary);
		font-size: 0.9rem;
	}
	.dashboard-verification-copy { min-width: 0; flex: 1; }
	.dashboard-verification-copy strong { display: block; font-size: 0.65rem; line-height: 1.3; }
	.dashboard-verification-copy span { display: block; margin-top: 0.15rem; color: var(--color-text-muted); font-size: 0.625rem; line-height: 1.3; }
	.dashboard-verification-action { flex: 0 0 auto; }
	.dashboard-verification-action :global(.ui-button) { padding-inline: 0.5rem; font-size: 0.65rem; }
	.dashboard-action-grid { display: grid; grid-template-columns: 1fr; gap: 0.625rem; }
	.dashboard-action-card {
		display: flex;
		min-width: 0;
		min-height: 4.25rem;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		color: var(--color-text);
		text-decoration: none;
		transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
	}
	.dashboard-action-card:hover { border-color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border)); box-shadow: var(--shadow-raised); }
	.dashboard-action-icon {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 0.625rem;
		font-size: 1rem;
	}
	.dashboard-action-icon.ready { background: color-mix(in srgb, var(--color-success) 9%, var(--color-surface)); color: var(--color-success); }
	.dashboard-action-icon.correction { background: color-mix(in srgb, var(--color-warning) 11%, var(--color-surface)); color: var(--color-warning); }
	.dashboard-action-copy {
		display: grid;
		min-width: 0;
		flex: 1;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
		align-items: center;
		gap: 0.5rem;
	}
	.dashboard-action-copy strong { display: block; font-size: 0.7rem; line-height: 1.3; }
	.dashboard-action-copy span { display: block; margin-top: 0.2rem; color: var(--color-text-muted); font-size: 0.625rem; line-height: 1.35; }
	.dashboard-action-card.ready strong { color: var(--color-success); }
	.dashboard-action-card.correction strong { color: var(--color-warning); }
	.dashboard-action-chevron { flex: 0 0 auto; color: var(--color-text-muted); font-size: 0.7rem; }

	@media (min-width: 640px) {
		.dashboard-action-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (max-width: 1023px) {
		.dashboard-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (max-width: 359px) {
		.dashboard-stat-grid { grid-template-columns: 1fr; }
		.staff-dashboard-page :global(.ui-stat-card) { min-height: 4.5rem; }
		.dashboard-verification-card { flex-wrap: wrap; }
		.dashboard-verification-action { margin-left: auto; }
	}
	@media (max-width: 640px) {
		.dashboard-activity-title {
			display: -webkit-box;
			overflow: hidden;
			white-space: normal;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
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

<div class="staff-dashboard-page">
	<!-- Stats -->
	<div class="dashboard-stat-grid ui-stat-grid">
		<a href="/staff/students" class="dashboard-stat-link"><StatCard label="Total Students" value={data.counts.students} icon="fa-solid fa-users" color="blue" /></a>
		<a href="/staff/requests" class="dashboard-stat-link"><StatCard label="Total Requests" value={data.counts.requests} icon="fa-solid fa-file-lines" color="teal" /></a>
		<a href="/staff/requests?status=Pending" class="dashboard-stat-link"><StatCard label="Pending Requests" value={data.counts.pending} icon="fa-solid fa-clock" color="orange" actionIndicator /></a>
		<a href="/staff/requests?status=Approved" class="dashboard-stat-link"><StatCard label="Approved" value={data.counts.approved} icon="fa-solid fa-circle-check" color="green" actionIndicator /></a>
	</div>
	{#if data.role === 'Admin'}
		<div class="dashboard-verification-card">
			<div class="dashboard-verification-icon" aria-hidden="true"><i class="fa-solid fa-graduation-cap"></i></div>
			<div class="dashboard-verification-copy">
				<strong>Student IDs awaiting office verification</strong>
				<span>{data.counts.pendingVerification} {pluralize(data.counts.pendingVerification, 'student')} pending verification.</span>
			</div>
			<Button href="/staff/students?status=pending" variant="secondary" size="sm" class="dashboard-verification-action">Review now</Button>
		</div>
	{/if}

	<div class="dashboard-action-grid">
		<a href="/staff/requests?status=Approved&amp;delivery=waiting" class="dashboard-action-card ready">
			<span class="dashboard-action-icon ready" aria-hidden="true"><i class="fa-solid fa-file-lines"></i></span>
			<span class="dashboard-action-copy">
				<strong>{data.counts.awaitingDelivery} {pluralize(data.counts.awaitingDelivery, 'request')} ready for release</strong>
				<span>Open a request and mark it released after the student collects the document.</span>
			</span>
			<i class="fa-solid fa-chevron-right dashboard-action-chevron" aria-hidden="true"></i>
		</a>
		<a href="/staff/requests?status=Correction%20Requested" class="dashboard-action-card correction">
			<span class="dashboard-action-icon correction" aria-hidden="true"><i class="fa-solid fa-rotate-left"></i></span>
			<span class="dashboard-action-copy">
				<strong>{data.counts.awaitingCorrections} {pluralize(data.counts.awaitingCorrections, 'request')} awaiting student corrections</strong>
				<span>Review outstanding corrections and office messages.</span>
			</span>
			<i class="fa-solid fa-chevron-right dashboard-action-chevron" aria-hidden="true"></i>
		</a>
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
