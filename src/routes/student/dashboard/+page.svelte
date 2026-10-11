<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type RequestItem = { document_id: number; name: string };
	type DashboardRequest = { completed_at?: string | null; approved_file_path?: string | null; request_id: string; document_name: string; items: RequestItem[]; status: string; date_requested: string };
	const activeRequests = $derived((data.requests as DashboardRequest[]).filter(req => !req.completed_at).sort((a,b) => Number(b.status === 'Correction Requested') - Number(a.status === 'Correction Requested')));
	let expandedRequests = $state<string[]>([]);
	const locked = $derived(data.layoutUser.idStatus !== 'verified');
	const lockReason = 'Available after your ID is verified';
	const nextStep = $derived(data.layoutUser.idStatus === 'verified' ? 'Choose Request Document to start.' : data.layoutUser.idStatus === 'rejected' ? 'Upload a new ID photo, then resubmit.' : 'Wait for the office to finish reviewing. You can browse Forms meanwhile.');

	const recentNotifs = $derived(
		data.recentHistory.map((h) => ({
			id: String(h.history_id),
			title: h.request_id ? `${h.document_name ?? 'Document request'}: ${h.new_status}` : String(h.new_status),
			date: new Date(h.changed_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
		}))
	);

	const quickActions = [
		{ icon: 'fa-solid fa-file-circle-plus', label: 'Request Document', href: '/student/request', color: 'quick-action-primary' },
		{ icon: 'fa-solid fa-folder-open', label: 'My Documents', href: '/student/documents', color: 'quick-action-secondary' },
		{ icon: 'fa-regular fa-bell', label: 'Notifications', href: '/student/notifications', color: 'quick-action-secondary' },
		{ icon: 'fa-solid fa-circle-user', label: 'My Profile', href: '/student/profile', color: 'quick-action-secondary' }
	];
</script>

<div class="space-y-5">
	<div class="next-step-panel rounded-xl border border-gray-100 bg-white p-5 text-sm">
		<p class="font-semibold text-gray-800">Your next step</p><p class="mt-1 text-gray-600">{nextStep}</p>
	</div>
	<div class="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
		<!-- Active Requests -->
		<div class="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
				<div>
					<h2 class="font-semibold text-gray-800">Active Document Requests</h2>
					<p class="text-xs text-gray-400 mt-0.5">{activeRequests.length} in progress</p>
				</div>
				<a href="/student/documents" class="text-sm text-essu-green font-medium hover:underline">
					View all <i class="fa-solid fa-arrow-right text-xs ml-1"></i>
				</a>
			</div>

			{#if activeRequests.length === 0}
				<div class="py-12 text-center">
					<i class="fa-solid fa-file-circle-plus text-3xl text-gray-200 mb-3"></i>
					<p class="text-sm text-gray-400">No active requests</p>
					<div class="mt-3">{#if locked}<button type="button" aria-disabled="true" title={lockReason} aria-label={`Request a document. ${lockReason}`} class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-essu-green/25 px-4 text-sm font-medium text-essu-green"><i class="fa-solid fa-lock" aria-hidden="true"></i>Request a document</button>{:else}<Button href="/student/request" size="sm">Request a document</Button>{/if}</div>
				</div>
			{:else}
				<div class="divide-y divide-gray-50">
					{#each activeRequests as req}
						<div class="dashboard-request-row flex items-center gap-4 px-5 py-3.5">
							<div class="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
								<i class="fa-solid fa-file text-blue-500 text-sm"></i>
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-800">{req.items?.[0]?.name ?? req.document_name}{#if (req.items?.length ?? 0) > 1}<button type="button" class="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-essu-green" onclick={() => expandedRequests = expandedRequests.includes(req.request_id) ? expandedRequests.filter((id) => id !== req.request_id) : [...expandedRequests, req.request_id]}>+{req.items.length - 1} more</button>{/if}</p>
								{#if expandedRequests.includes(req.request_id)}<p class="text-xs text-gray-500">{req.items.map((item) => item.name).join(', ')}</p>{/if}
								<p class="text-xs text-gray-400">{req.request_id} · {new Date(req.date_requested as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}</p>
							</div>
							<div class="shrink-0">
								<Badge value={(req.status as string).toLowerCase()} size="sm" /><a href={'/student/documents#' + req.request_id} class="block mt-2 text-xs text-essu-green underline focus:outline-none focus:ring-2 focus:ring-essu-green/30">{req.status === 'Correction Requested' ? 'Upload corrections' : req.status === 'Approved' ? 'Get document' : 'Track request'}</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Right column -->
		<div class="space-y-4">
			<!-- Notifications snippet -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
				<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
					<h2 class="font-semibold text-gray-800 text-sm">Recent Notifications</h2>
					<a href="/student/notifications" class="text-xs text-essu-green hover:underline">View all</a>
				</div>
				{#if recentNotifs.length === 0}
					<div class="py-6 text-center"><p class="mb-3 text-sm text-gray-600">No notifications yet. Office updates will appear here.</p><Button variant="secondary" href="/student/notifications" size="sm">View notifications</Button></div>
				{:else}
					<div class="divide-y divide-gray-50">
						{#each recentNotifs as notif}
							<div class="flex items-start gap-2.5 px-4 py-3">
								<span class="w-1.5 h-1.5 bg-essu-green rounded-full mt-1.5 shrink-0"></span>
								<div class="min-w-0">
									<p class="text-xs font-medium text-gray-800 leading-tight">{notif.title}</p>
									<p class="text-xs text-gray-400 mt-0.5">{notif.date}</p>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Quick Actions -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
				<h2 class="font-semibold text-gray-800 mb-3 text-sm">Quick Actions</h2>
				<div class="grid grid-cols-1 gap-2">
					{#each quickActions as action}
						{#if action.href === '/student/request' && locked}
							<button type="button" aria-disabled="true" title={lockReason} aria-label={`${action.label}. ${lockReason}`} class="quick-action-link quick-action-secondary flex min-h-11 items-center gap-3 rounded-xl border border-essu-green/20 px-4 py-3 text-left">
								<i class="fa-solid fa-lock text-lg" aria-hidden="true"></i><span class="flex-1 text-sm font-medium">{action.label}</span>
							</button>
						{:else}
						<a
							href={action.href}
							class="quick-action-link {action.color} flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors"
						>
							<i class="{action.icon} text-lg"></i>
							<span class="flex-1 text-sm font-medium">{action.label}</span><i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
						</a>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
