<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { markAllRead as markStoreAllRead, markOneRead, notifUnreadCount } from '$lib/stores/notifications';
		import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type Notif = {
		id: string;
		type: 'request' | 'task' | 'system';
		title: string;
		message: string;
		date: string;
		isRead: boolean;
		actionItems?: string[];
		relatedRequestId?: string;
	};

	function mapHistory(h: Record<string, unknown>): Notif {
		const status = h.new_status as string;
		if (!h.request_id) return { id: String(h.history_id), type: 'system', title: status, message: status, date: new Date(h.changed_at as string).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }), isRead: !!h.student_read };
		const type: Notif['type'] =
			status === 'Approved' ? 'request'
			: status === 'Correction Requested' ? 'task'
			: 'system';
		const adminMsg = h.admin_message as string | null;
		const message =
			status === 'Completed'
				? `The office recorded delivery for request ${h.request_id}. You can view its timeline in My Documents.`
			: status === 'Approved'
				? `Your request for ${h.document_name} (${h.request_id}) has been approved. You may now download the document from My Documents.`
			: status === 'Rejected'
				? `Your request for ${h.document_name} (${h.request_id}) has been rejected.${adminMsg ? ' Reason: ' + adminMsg : ''}`
			: status === 'Correction Requested'
				? `Your request for ${h.document_name} (${h.request_id}) requires corrections.${adminMsg ? ' ' + adminMsg : ''}`
			: `Your request for ${h.document_name} (${h.request_id}) has been submitted and is pending review.`;

		return {
			id: String(h.history_id),
			type,
			title: `${h.document_name}: ${status}`,
			message,
			date: new Date(h.changed_at as string).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
			isRead: !!(h.student_read),
			actionItems: status === 'Correction Requested' && adminMsg ? [adminMsg] : undefined,
			relatedRequestId: h.request_id as string
		};
	}

	let notifications = $state(data.history.map(mapHistory));

	$effect(() => {
		const loadedHistory = data.history.map(mapHistory);
		notifications = loadedHistory;
		notifUnreadCount.set(loadedHistory.filter((n) => !n.isRead).length);
	});

	let activeFilter = $state('all');
	let search = $state('');
	let currentPage = $state(1);
	const itemsPerPage = 5;
	$effect(() => { activeFilter; search; currentPage = 1; });
	let selectedNotif = $state<Notif | null>(null);
	let detailOpen = $state(false);
	let toastMessage = $state('');

	const filterOptions = ['all', 'request', 'task', 'system'];

	const filtered = $derived(
		notifications.filter((n) => {
			const matchFilter = activeFilter === 'all' || n.type === activeFilter;
			const q = search.toLowerCase();
			const matchSearch = !q || n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
			return matchFilter && matchSearch;
		})
	);

	const paginated = $derived(filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));
	const unreadCount = $derived(notifications.filter((n) => !n.isRead).length);
	const requestCount = $derived(notifications.filter((n) => n.type === 'request').length);

	async function markRead(ids: string[]) {
		const wasUnread = notifications.filter((n) => ids.includes(n.id) && !n.isRead);
		if (!wasUnread.length) return;
		notifications = notifications.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n);
		try {
			await markOneRead({ type: 'student-history', ids: wasUnread.map((n) => Number(n.id)) });
		} catch {
			notifications = notifications.map(n => ids.includes(n.id) ? { ...n, isRead: false } : n);
			toastMessage = 'Could not mark notifications as read.';
			setTimeout(() => toastMessage = '', 4000);
		}
	}

	async function markAllNotificationsRead() {
		const ids = notifications.filter((n) => !n.isRead).map((n) => n.id);
		if (!ids.length) return;
		notifications = notifications.map((n) => ({ ...n, isRead: true }));
		try {
			await markStoreAllRead([{ type: 'student-history', ids: ids.map(Number) }]);
		} catch {
			notifications = notifications.map((n) => ids.includes(n.id) ? { ...n, isRead: false } : n);
			toastMessage = 'Could not mark notifications as read.';
			setTimeout(() => toastMessage = '', 4000);
		}
	}


	function viewDetail(notif: Notif) {
		selectedNotif = notif;
		detailOpen = true;
		if (!notif.isRead) markRead([notif.id]);
	}

	const typeIconMap: Record<string, { icon: string; color: string; bg: string }> = {
		request: { icon: 'fa-solid fa-file-circle-check', color: 'text-blue-600',   bg: 'bg-blue-50'   },
		task:    { icon: 'fa-solid fa-clipboard-list',    color: 'text-purple-600', bg: 'bg-purple-50' },
		system:  { icon: 'fa-solid fa-gear',              color: 'text-gray-600',   bg: 'bg-gray-100'  }
	};
</script>

<div class="space-y-5">
	<div class="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
		<div class="flex items-center gap-2 flex-wrap">
			{#each filterOptions as opt}
				<button
					onclick={() => { activeFilter = opt; currentPage = 1; }}
					class="px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors
						{activeFilter === opt ? 'bg-essu-blue text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}"
				>
					{opt}
				</button>
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
				<input type="text" bind:value={search} placeholder="Search..." oninput={() => (currentPage = 1)} class="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30 w-full sm:w-44" />
			</div>
			{#if unreadCount > 0}
				<button onclick={() => void markAllNotificationsRead()} class="min-h-11 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-essu-green/30">
					<i class="fa-solid fa-check-double mr-1 text-xs"></i>Mark all as read
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
						{!notif.isRead ? 'border-essu-blue/30 bg-blue-50/20' : 'border-gray-100'}"
				>
					<div class="w-10 h-10 rounded-xl {meta.bg} {meta.color} flex items-center justify-center shrink-0">
						<i class="{meta.icon} text-sm"></i>
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-start justify-between gap-2">
							<div class="flex items-center gap-2">
								<p class="text-sm {notif.isRead ? 'font-medium' : 'font-bold'} text-gray-800">{notif.title}</p>
								{#if !notif.isRead}
									<span class="w-2 h-2 bg-essu-blue rounded-full inline-block shrink-0"></span>
								{/if}
							</div>
							<p class="text-xs text-gray-400 whitespace-nowrap shrink-0">{notif.date}</p>
						</div>
						<p class="text-sm text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
						{#if notif.actionItems?.length}
							<p class="text-xs text-essu-blue mt-1 font-medium">
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

<Modal open={detailOpen} title="Notification" size="md" onclose={() => (detailOpen = false)}>
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
						<p class="text-sm font-semibold text-gray-700 mb-2">What you need to do</p>
						<ul class="space-y-1.5">
							{#each selectedNotif.actionItems as action}
								<li class="flex items-center gap-2 text-sm text-gray-600">
									<i class="fa-solid fa-arrow-right text-essu-blue text-xs"></i>
									{action}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if selectedNotif.relatedRequestId}
					<a href={'/student/documents#' + selectedNotif.relatedRequestId} class="inline-flex items-center gap-2 text-sm text-essu-blue hover:underline font-medium">
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
{#if toastMessage}<div class="fixed bottom-5 right-5 z-[70] rounded-lg bg-red-700 px-4 py-3 text-sm text-white shadow-lg" role="status" aria-live="polite">{toastMessage}</div>{/if}
