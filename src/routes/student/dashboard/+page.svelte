<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	const activeRequests = $derived(data.requests);

	const recentNotifs = $derived(
		data.recentHistory.map((h) => ({
			id: String(h.history_id),
			title: `${h.document_name}: ${h.new_status}`,
			date: new Date(h.changed_at as string).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
		}))
	);

	const quickActions = [
		{ icon: 'fa-solid fa-file-circle-plus', label: 'Request Document', href: '/student/request', color: 'bg-essu-green text-white hover:bg-essu-green-mid' },
		{ icon: 'fa-solid fa-folder-open', label: 'My Documents', href: '/student/documents', color: 'bg-blue-600 text-white hover:bg-blue-700' },
		{ icon: 'fa-regular fa-bell', label: 'Notifications', href: '/student/notifications', color: 'bg-purple-600 text-white hover:bg-purple-700' },
		{ icon: 'fa-solid fa-circle-user', label: 'My Profile', href: '/student/profile', color: 'bg-gray-700 text-white hover:bg-gray-800' }
	];
</script>

<div class="space-y-5">
	<!-- Welcome banner -->
	<div class="bg-gradient-to-r from-essu-green to-essu-green-mid rounded-2xl p-6 text-white">
		<p class="text-white/80 text-sm mb-1">Welcome back,</p>
		<h2 class="text-2xl font-bold">{data.layoutUser.name}</h2>
		<p class="text-white/70 text-sm mt-1">
			{data.layoutUser.program}{data.layoutUser.studentId ? ` · ID: ${data.layoutUser.studentId}` : ''}
		</p>
	</div>

	<div class="grid grid-cols-1 xl:grid-cols-3 gap-5">
		<!-- Active Requests -->
		<div class="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
				<div>
					<h3 class="font-semibold text-gray-800">Active Document Requests</h3>
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
					<a href="/student/request" class="mt-3 inline-block text-sm text-essu-green font-medium hover:underline">
						Request a document →
					</a>
				</div>
			{:else}
				<div class="divide-y divide-gray-50">
					{#each activeRequests as req}
						<div class="flex items-center gap-4 px-5 py-3.5">
							<div class="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
								<i class="fa-solid fa-file text-blue-500 text-sm"></i>
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-800">{req.document_name}</p>
								<p class="text-xs text-gray-400">{req.request_id} · {new Date(req.date_requested as string).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
							</div>
							<div class="shrink-0">
								<Badge value={(req.status as string).toLowerCase()} size="sm" />
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
					<h3 class="font-semibold text-gray-800 text-sm">Recent Notifications</h3>
					<a href="/student/notifications" class="text-xs text-essu-green hover:underline">View all</a>
				</div>
				{#if recentNotifs.length === 0}
					<p class="text-sm text-gray-400 text-center py-6">No new notifications</p>
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
				<h3 class="font-semibold text-gray-800 mb-3 text-sm">Quick Actions</h3>
				<div class="grid grid-cols-2 gap-2">
					{#each quickActions as action}
						<a
							href={action.href}
							class="{action.color} flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-colors"
						>
							<i class="{action.icon} text-lg"></i>
							<span class="text-xs font-medium leading-tight">{action.label}</span>
						</a>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
