<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { notifUnreadCount } from '$lib/stores/notifications';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type Notif = {
		id: string;
		source: 'request' | 'history';
		type: 'request' | 'task' | 'system';
		title: string;
		message: string;
		date: string;
		isRead: boolean;
		actionItems?: string[];
		relatedRequestId?: string;
	};

	function fmtDate(d: unknown) {
		return new Date(d as string).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
	}

	// New unreviewed pending requests → type 'request', isRead from staff_viewed
	const fromNew: Notif[] = (data.newRequests as Record<string, unknown>[]).map(r => ({
		id: String(r.request_id),
		source: 'request' as const,
		type: 'request' as const,
		title: `New Request: ${r.document_name}`,
		message: `${r.first_name} ${r.last_name} submitted a new request for ${r.document_name} (${r.request_id}).`,
		date: fmtDate(r.date_requested),
		isRead: !!(r.staff_viewed),
		relatedRequestId: r.request_id as string
	}));

	// Status history → isRead from is_read column
	const fromHistory: Notif[] = (data.history as Record<string, unknown>[]).map(h => {
		const status = h.new_status as string;
		const type: Notif['type'] =
			status === 'Correction Requested' ? 'task' :
			status === 'Approved'             ? 'system' : 'system';
		const adminMsg = h.admin_message as string | null;
		const message =
			status === 'Approved'             ? `${h.first_name} ${h.last_name}'s request for ${h.document_name} (${h.request_id}) was approved.` :
			status === 'Rejected'             ? `${h.first_name} ${h.last_name}'s request for ${h.document_name} (${h.request_id}) was rejected.${adminMsg ? ' Note: ' + adminMsg : ''}` :
			status === 'Correction Requested' ? `Correction requested for ${h.first_name} ${h.last_name}'s request (${h.request_id}).${adminMsg ? ' ' + adminMsg : ''}` :
			                                    `${h.document_name} request (${h.request_id}) status changed to ${status}.`;
		return {
			id: String(h.history_id),
			source: 'history' as const,
			type,
			title: `${h.document_name}: ${status}`,
			message,
			date: fmtDate(h.changed_at),
			isRead: !!(h.is_read),
			actionItems: status === 'Correction Requested' && adminMsg ? [adminMsg] : undefined,
			relatedRequestId: h.request_id as string
		};
	});

	// Merge: new requests first (unread), then history
	let notifications = $state<Notif[]>([...fromNew, ...fromHistory]);

	$effect(() => { notifUnreadCount.set(unreadCount); });

	let activeFilter = $state('all');
	let search = $state('');
	let currentPage = $state(1);
	const itemsPerPage = 5;
	let selectedNotif = $state<Notif | null>(null);
	let detailOpen = $state(false);

	const filterOptions = ['all', 'request', 'task', 'system'];

	const filtered = $derived(
		notifications.filter(n => {
			const matchFilter = activeFilter === 'all' || n.type === activeFilter;
			const q = search.toLowerCase();
			const matchSearch = !q || n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
			return matchFilter && matchSearch;
		})
	);

	const paginated = $derived(filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));
	const unreadCount = $derived(notifications.filter(n => !n.isRead).length);

	async function markRead(toMark: Notif[]) {
		const ids = toMark.map(n => n.id);
		notifications = notifications.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n);
		const reqIds = toMark.filter(n => n.source === 'request').map(n => n.id);
		const histIds = toMark.filter(n => n.source === 'history').map(n => Number(n.id));
		if (reqIds.length) await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'request', ids: reqIds }) });
		if (histIds.length) await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'history', ids: histIds }) });
	}

	function markAllRead() { markRead(notifications.filter(n => !n.isRead)); }

	function viewDetail(notif: Notif) {
		selectedNotif = notif;
		detailOpen = true;
		if (!notif.isRead) markRead([notif]);
	}

	const typeIconMap: Record<string, { icon: string; color: string; bg: string }> = {
		request: { icon: 'fa-solid fa-file-circle-check',   color: 'text-blue-600',   bg: 'bg-blue-50'   },
task:    { icon: 'fa-solid fa-clipboard-list',       color: 'text-purple-600', bg: 'bg-purple-50' },
		system:  { icon: 'fa-solid fa-gear',                 color: 'text-gray-600',   bg: 'bg-gray-100'  }
	};
</script>

<div class="space-y-5">
	<div class="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
		<div class="flex items-center gap-2 flex-wrap">
			{#each filterOptions as opt}
				<button
					onclick={() => { activeFilter = opt; currentPage = 1; }}
					class="px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors
						{activeFilter === opt ? 'bg-essu-green text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}"
				>{opt}</button>
			{/each}
		</div>
		<div class="flex items-center gap-2 flex-wrap sm:ml-auto">
			<span class="inline-flex items-center gap-1.5 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
				<i class="fa-regular fa-bell text-gray-400 text-xs"></i>
				<span class="font-semibold text-gray-700">{notifications.length}</span> total
			</span>
			{#if unreadCount > 0}
				<span class="inline-flex items-center gap-1.5 text-sm text-orange-600 bg-white border border-gray-200 rounded-lg px-3 py-2">
					<i class="fa-solid fa-envelope text-xs"></i>
					<span class="font-semibold">{unreadCount}</span> unread
				</span>
			{/if}
			<div class="relative">
				<i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
				<input type="text" bind:value={search} placeholder="Search notifications..."
					oninput={() => (currentPage = 1)}
					class="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30 w-full sm:w-48" />
			</div>
			{#if unreadCount > 0}
				<button onclick={markAllRead}
					class="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
					<i class="fa-solid fa-check-double mr-1 text-xs"></i>Mark all read
				</button>
			{/if}
		</div>
	</div>

	<div class="space-y-2">
		{#if paginated.length === 0}
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<EmptyState message="No notifications found" icon="fa-regular fa-bell-slash" />
			</div>
		{:else}
			{#each paginated as notif}
				{@const meta = typeIconMap[notif.type]}
				<button
					onclick={() => viewDetail(notif)}
					class="notification-item w-full text-left bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-all flex items-start gap-4
						{!notif.isRead ? 'border-essu-green/30 bg-green-50/30' : 'border-gray-100'}"
				>
					<div class="w-10 h-10 rounded-xl {meta.bg} {meta.color} flex items-center justify-center shrink-0">
						<i class="{meta.icon} text-sm"></i>
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-start justify-between gap-2">
							<div class="flex items-center gap-2">
								<p class="text-sm font-semibold text-gray-800">{notif.title}</p>
								{#if !notif.isRead}
									<span class="w-2 h-2 bg-essu-green rounded-full inline-block shrink-0"></span>
								{/if}
							</div>
							<p class="text-xs text-gray-400 whitespace-nowrap shrink-0">{notif.date}</p>
						</div>
						<p class="text-sm text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
						{#if notif.actionItems?.length}
							<p class="text-xs text-essu-green mt-1 font-medium">
								<i class="fa-solid fa-list-check mr-1"></i>{notif.actionItems.length} action{notif.actionItems.length > 1 ? 's' : ''} required
							</p>
						{/if}
					</div>
					<Badge value={notif.type} size="sm" />
				</button>
			{/each}
		{/if}
	</div>

	{#if filtered.length > itemsPerPage}
		<div class="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2">
			<Pagination totalItems={filtered.length} {itemsPerPage} {currentPage} onPageChange={(p) => (currentPage = p)} />
		</div>
	{/if}
</div>

<Modal open={detailOpen} title="Notification Detail" size="md" onclose={() => (detailOpen = false)}>
	{#snippet body()}
		{#if selectedNotif}
			{@const meta = typeIconMap[selectedNotif.type]}
			<div class="space-y-4">
				<div class="flex items-start gap-3">
					<div class="w-10 h-10 rounded-xl {meta.bg} {meta.color} flex items-center justify-center shrink-0">
						<i class="{meta.icon}"></i>
					</div>
					<div>
						<p class="font-semibold text-gray-800">{selectedNotif.title}</p>
						<p class="text-xs text-gray-400 mt-0.5">{selectedNotif.date}</p>
					</div>
				</div>
				<p class="text-sm text-gray-600 leading-relaxed">{selectedNotif.message}</p>
				{#if selectedNotif.actionItems?.length}
					<div class="border-t border-gray-100 pt-3">
						<p class="text-sm font-semibold text-gray-700 mb-2">Action Items</p>
						<ul class="space-y-1.5">
							{#each selectedNotif.actionItems as action}
								<li class="flex items-center gap-2 text-sm text-gray-600">
									<i class="fa-regular fa-circle text-gray-300 text-xs"></i>{action}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if selectedNotif.relatedRequestId}
					<a href="/staff/requests/{selectedNotif.relatedRequestId}"
						class="inline-flex items-center gap-2 text-sm text-essu-green hover:underline font-medium">
						<i class="fa-solid fa-arrow-right text-xs"></i>
						View request {selectedNotif.relatedRequestId}
					</a>
				{/if}
			</div>
		{/if}
	{/snippet}
	{#snippet footer()}
		<button onclick={() => (detailOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Close</button>
	{/snippet}
</Modal>
