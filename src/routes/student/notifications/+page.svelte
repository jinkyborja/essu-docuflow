<script lang="ts">
	import { statusLabel, releaseWording } from '$lib/request-status';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { showToast } from '$lib/stores/toasts';
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
		const status = releaseWording(h.new_status as string);
		if (!h.request_id) return { id: String(h.history_id), type: 'system', title: status, message: status, date: new Date(h.changed_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }), isRead: !!h.student_read };
		const type: Notif['type'] =
			status === 'Approved' ? 'request'
			: status === 'Correction Requested' ? 'task'
			: 'system';
		const adminMsg = h.admin_message as string | null;
		const displayStatus = statusLabel(status);
		const message =
			status === 'Completed'
				? `The Graduate School office marked request ${h.request_id} as released. You can view its timeline in My Documents.`
			: status === 'Approved'
				? `Your request for ${h.document_name} (${h.request_id}) has been approved. Your document is ready for release at the Graduate School office.`
			: status === 'Rejected'
				? `Your request for ${h.document_name} (${h.request_id}) has been rejected.${adminMsg ? ' Reason: ' + adminMsg : ''}`
			: status === 'Correction Requested'
				? `Your request for ${h.document_name} (${h.request_id}) requires corrections.${adminMsg ? ' ' + adminMsg : ''}`
			: `Your request for ${h.document_name} (${h.request_id}) has been submitted and is pending review.`;

		return {
			id: String(h.history_id),
			type,
			title: `${h.document_name}: ${displayStatus}`,
			message,
			date: new Date(h.changed_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }),
			isRead: !!(h.student_read),
			actionItems: status === 'Correction Requested' && adminMsg ? [adminMsg] : undefined,
			relatedRequestId: h.request_id as string
		};
	}

	let notifications = $state<Notif[]>([]);

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
			showToast('Could not mark notifications as read. Please try again.', 'error');
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
			showToast('Could not mark notifications as read. Please try again.', 'error');
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

	const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
	const todayIds = $derived(new Set(data.history.filter(h => !Number.isNaN(Date.parse(String(h.changed_at))) && dayFormat.format(new Date(String(h.changed_at))) === dayFormat.format(new Date())).map(h => String(h.history_id))));
	const notificationGroups = $derived([{ label: 'Today', items: paginated.filter(notif => todayIds.has(notif.id)) }, { label: 'Earlier', items: paginated.filter(notif => !todayIds.has(notif.id)) }]);
</script>

<div class="student-notifications">
	<div class="notification-toolbar">
		<div class="notification-filters" aria-label="Notification types">{#each filterOptions as opt}<Button variant="secondary" ariaPressed={activeFilter === opt} class={activeFilter === opt ? 'notification-filter selected' : 'notification-filter'} onclick={() => { activeFilter = opt; currentPage = 1; }}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</Button>{/each}</div>
		<div class="notification-controls"><span class="notification-total"><i class="fa-regular fa-bell" aria-hidden="true"></i>{notifications.length} total{#if unreadCount > 0} · {unreadCount} unread{/if}</span><label class="notification-search"><span class="sr-only">Search notifications</span><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" bind:value={search} placeholder="Search notifications…" oninput={() => currentPage = 1} /></label>{#if unreadCount > 0}<Button variant="secondary" icon="fa-solid fa-check-double" onclick={() => void markAllNotificationsRead()}>Mark all as read</Button>{/if}</div>
	</div>
	{#if paginated.length === 0}
		<Card><EmptyState message={notifications.length ? 'No matching notifications' : 'No notifications yet'} description={notifications.length ? 'Clear the filters to see all notifications.' : 'Updates from the Graduate School office will appear here.'} icon="fa-regular fa-bell-slash" />{#snippet footer()}{#if notifications.length}<Button variant="secondary" onclick={() => { search = ''; activeFilter = 'all'; }}>Clear filters</Button>{:else}<Button variant="secondary" href="/student/forms">Browse forms</Button>{/if}{/snippet}</Card>
	{:else}
		{#each notificationGroups as group}{#if group.items.length}<section class="notification-group" aria-label={group.label}><h2>{group.label}</h2><div class="notification-list">{#each group.items as notif (notif.id)}
			{@const meta = typeIconMap[notif.type]}
			<button type="button" class="student-notification-item" class:unread={!notif.isRead} onclick={() => viewDetail(notif)} aria-label={notif.title + (notif.isRead ? '' : ', unread')}>
				<span class="notification-icon" aria-hidden="true"><i class={meta.icon}></i></span><span class="notification-copy"><span class="notification-heading"><span class="notification-title">{notif.title}</span>{#if !notif.isRead}<span class="unread-dot" aria-hidden="true"></span>{/if}</span><span class="notification-message">{notif.message}</span>{#if notif.actionItems?.length}<span class="notification-action-note"><i class="fa-solid fa-list-check" aria-hidden="true"></i>{notif.actionItems.length} action{notif.actionItems.length > 1 ? 's' : ''} required</span>{/if}</span><span class="notification-meta"><span>{notif.date}</span><Badge value={notif.type} size="sm" /></span>
			</button>
		{/each}</div></section>{/if}{/each}
	{/if}
	{#if filtered.length > itemsPerPage}<Card><Pagination totalItems={filtered.length} {itemsPerPage} {currentPage} onPageChange={(p) => currentPage = p} /></Card>{/if}
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
		<Button variant="secondary" onclick={() => (detailOpen = false)}>Close</Button>
	{/snippet}
</Modal>

<style>
	.student-notifications { display: flex; flex-direction: column; gap: var(--space-6); }
	.notification-toolbar, .notification-filters, .notification-controls { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
	.notification-toolbar { justify-content: space-between; gap: var(--space-4); }
	.notification-filters { gap: var(--space-2); }
	:global(.notification-filter.selected.ui-button) { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); }
	.notification-total { display: inline-flex; align-items: center; gap: var(--space-2); color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.notification-search { position: relative; flex: 1; min-width: 160px; }
	.notification-search > i { position: absolute; top: 50%; left: var(--space-3); transform: translateY(-50%); color: var(--color-text-muted); }
	.notification-search input { width: 100%; min-height: var(--control-height); padding: var(--space-2) var(--space-3) var(--space-2) var(--space-8); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font-size: var(--font-size-input); }
	h2 { margin: 0 0 var(--space-3); color: var(--color-text); font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); }
	.notification-list { display: flex; flex-direction: column; gap: var(--space-3); }
	.student-notification-item { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--space-4); width: 100%; padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); color: var(--color-text); font-size: var(--font-size-body); line-height: var(--line-height); text-align: left; cursor: pointer; transition: background-color var(--motion-fast), border-color var(--motion-fast), box-shadow var(--motion-fast); }
	.student-notification-item:hover { border-color: var(--color-primary); background: var(--color-primary-soft); box-shadow: var(--shadow-raised); }
	.student-notification-item:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; box-shadow: var(--focus-ring); }
	.student-notification-item.unread { border-color: var(--color-primary); }
	.notification-icon { display: grid; place-items: center; flex-shrink: 0; width: var(--control-height); height: var(--control-height); border-radius: var(--radius-control); background: var(--color-primary-soft); color: var(--color-primary); font-size: var(--font-size-card-title); }
	.notification-copy { flex: 1; min-width: 0; }
	.notification-heading { display: flex; align-items: flex-start; gap: var(--space-2); }
	.notification-title { font-weight: var(--font-weight-medium); }
	.unread .notification-title { font-weight: var(--font-weight-semibold); }
	.unread-dot { flex-shrink: 0; width: var(--space-2); height: var(--space-2); margin-top: var(--space-2); border-radius: 50%; background: var(--color-primary); }
	.notification-message { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; margin-top: var(--space-1); color: var(--color-text-muted); }
	.notification-action-note { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); color: var(--color-primary); font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); }
	.notification-meta { display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2); color: var(--color-text-muted); font-size: var(--font-size-helper); }
	@media (max-width: 639px) {
		.notification-controls { width: 100%; min-width: 0; }
		.notification-filters { width: 100%; }
		.notification-search { width: 100%; min-width: 0; }
		.notification-search input { width: 100%; }
		.notification-meta { flex-basis: 100%; flex-direction: row; justify-content: space-between; }
		.notification-controls :global(.ui-button) { max-width: 100%; white-space: normal; }
	}
</style>
