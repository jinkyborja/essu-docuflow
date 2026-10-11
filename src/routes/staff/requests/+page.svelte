<script lang="ts">
	import { formatDate } from '$lib/request-flow';
	import { formatName, pluralize } from '$lib/formatting';
	import { statusLabel, requestStatusKey } from '$lib/request-status';
	import Button from '$lib/components/ui/Button.svelte';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import DocumentPopover from '$lib/components/ui/DocumentPopover.svelte';
	
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';
	const { data }: { data: PageData } = $props();
	type Req = { completed_at?: string | null; request_id: string; document_name: string; student_name: string; first_name?: string; middle_name?: string; last_name?: string; student_code: string; program: string; status: string; date_requested: string; items: Array<{document_id: number; name: string}> };
	let requests = $state(data.requests as Req[]);
	let search = $state(''), filterStatus = $state(data.initialStatus ?? ''), deliveryWaiting = $state(!!data.deliveryWaiting);
	$effect(() => { requests = data.requests as Req[]; filterStatus = data.initialStatus ?? ''; deliveryWaiting = !!data.deliveryWaiting; });
	const menuItems = [{label: 'Cancel request', danger: true, disabled: true, reason: 'Not available yet'}, {label: 'Archive', disabled: true, reason: 'Not available yet'}];
 const tabs = [{status:'',key:'all',label:'All'},{status:'Pending',key:'pending',label:'Pending review'},{status:'Correction Requested',key:'correction_requested',label:'Needs correction'},{status:'Approved',key:'approved',label:'Approved'},{status:'Processing',key:'processing',label:'Processing'},{status:'Ready for pickup',key:'ready_for_pickup',label:'Ready for pickup'},{status:'Released',key:'released',label:'Released'},{status:'Rejected',key:'rejected',label:'Rejected'},{status:'Cancelled',key:'cancelled',label:'Cancelled'}];
 function needsReview(req: Req) { return ['pending','correction_requested'].includes(requestStatusKey(req.status) ?? ''); }
	function toggleStatus(status: string) { filterStatus = filterStatus === status ? '' : status; if (filterStatus !== 'Approved') deliveryWaiting = false; }
	function toggleDelivery() { deliveryWaiting = !deliveryWaiting; if (deliveryWaiting) filterStatus = 'Approved'; }
	function person(req: Req) { return formatName(req.first_name, req.middle_name, req.last_name) || req.student_name; }
	const filtered = $derived(requests.filter(req => {
		const q = search.trim().toLowerCase();
		return (!q || person(req).toLowerCase().includes(q) || req.request_id.toLowerCase().includes(q) || req.student_code?.toLowerCase().includes(q) || req.items?.some(item => item.name.toLowerCase().includes(q))) &&
			(!filterStatus || requestStatusKey(req.status) === requestStatusKey(filterStatus)) &&
			(!deliveryWaiting || (requestStatusKey(req.status) === 'approved' && !req.completed_at));
	}));
</script>
<div class="space-y-5">
 <nav class="request-tabs" aria-label="Request status filters">{#each tabs as tab}<button type="button" aria-pressed={requestStatusKey(filterStatus) === (tab.key === 'all' ? null : tab.key)} onclick={() => toggleStatus(tab.status)}>{tab.label}<span>{tab.key === 'all' ? requests.length : requests.filter(req=>requestStatusKey(req.status)===tab.key).length}</span></button>{/each}</nav>
	<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
		<label class="relative min-w-0 flex-1"><span class="sr-only">Search requests</span><i aria-hidden="true" class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-gray-400 text-sm"></i><input bind:value={search} type="search" placeholder="Search by name, request ID or student ID..." class="min-h-11 w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" /></label>
		<button type="button" aria-pressed={deliveryWaiting} title="Approved requests awaiting delivery confirmation" onclick={toggleDelivery} class="min-h-11 rounded-full border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30 {deliveryWaiting ? 'border-essu-green bg-essu-green/10 text-essu-green' : 'border-gray-200 bg-white text-gray-600'}"><i class="fa-solid fa-truck mr-1.5" aria-hidden="true"></i>Awaiting delivery</button>
		{#if search || filterStatus || deliveryWaiting}<Button variant="ghost" onclick={() => { search = ''; filterStatus = ''; deliveryWaiting = false; }}>Clear</Button>{/if}
	</div>
	<div class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
		<p class="border-b border-gray-100 px-5 py-4 text-sm text-gray-500" aria-live="polite"><span class="font-medium text-gray-800">{filtered.length}</span> {pluralize(filtered.length, 'request')} found</p>
		{#if !filtered.length}<EmptyState message="No requests found" description="Try another search or clear the filters to see all requests." icon="fa-solid fa-inbox" /><div class="flex justify-center pb-6"><Button variant="secondary" onclick={() => { search = ''; filterStatus = ''; deliveryWaiting = false; }}>Clear filters</Button></div>
		{:else}
			<div class="divide-y divide-gray-100 md:hidden">
				{#each filtered as req}<article class="space-y-3 p-4"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-sm font-medium text-gray-800">{person(req)}</p><p class="text-xs text-gray-500">{req.student_code ?? '—'} · {req.program ?? '—'}</p></div><StatusChip value={req.status} /></div><div class="text-sm">{req.items?.[0]?.name ?? req.document_name}<DocumentPopover items={req.items ?? []} /></div><div class="flex justify-between text-xs text-gray-500"><span class="font-mono">{req.request_id}</span><span>{formatDate(req.date_requested)}</span></div><div class="flex flex-nowrap items-center gap-2"><Button variant={needsReview(req) ? 'primary' : 'secondary'} size="sm" href={'/staff/requests/' + req.request_id} icon="fa-solid fa-eye">{needsReview(req) ? 'Review' : 'View'}</Button><RowMenu items={menuItems} label={'Actions for request ' + req.request_id} /></div></article>{/each}
			</div>
			<div class="hidden overflow-x-auto md:block"><table class="request-list-table w-full text-sm"><thead class="border-b border-gray-100 bg-gray-50"><tr>{#each ['Request ID', 'Student', 'Program', 'Document', 'Date', 'Status', 'Actions'] as col}<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{col}</th>{/each}</tr></thead><tbody class="divide-y divide-gray-50">
				{#each filtered as req}<tr class="hover:bg-gray-50"><td class="px-4 py-3 font-mono text-xs text-gray-500">{req.request_id}</td><td class="px-4 py-3"><p class="font-medium text-gray-800">{person(req)}</p><p class="text-xs text-gray-500">{req.student_code ?? '—'}</p></td><td class="px-4 py-3 text-gray-600">{req.program ?? '—'}</td><td class="px-4 py-3 text-gray-700">{req.items?.[0]?.name ?? req.document_name}<DocumentPopover items={req.items ?? []} /></td><td class="px-4 py-3 text-xs text-gray-500">{new Date(req.date_requested).toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila'})}</td><td class="px-4 py-3"><StatusChip value={req.status} /></td><td class="px-4 py-3"><div class="row-actions flex flex-nowrap items-center gap-2"><Button variant={needsReview(req) ? 'primary' : 'secondary'} size="sm" href={'/staff/requests/' + req.request_id} icon="fa-solid fa-eye">{needsReview(req) ? 'Review' : 'View'}</Button><RowMenu items={menuItems} label={'Actions for request ' + req.request_id} /></div></td></tr>{/each}
			</tbody></table></div>
		{/if}
	</div>
</div>

<style>.request-tabs {display:flex;gap:var(--space-1);overflow-x:auto;max-width:100%;padding-bottom:var(--space-2);border-bottom:1px solid var(--color-border);} .request-tabs button {display:flex;align-items:center;gap:var(--space-2);flex-shrink:0;min-height:40px;padding:var(--space-2) var(--space-3);border-radius:var(--radius-control);font-size:var(--type-body);color:var(--color-text-muted);white-space:nowrap;} .request-tabs button:hover {background:var(--color-primary-soft);} .request-tabs button[aria-pressed='true'] {background:var(--color-primary-soft);color:var(--color-primary);font-weight:var(--weight-semibold);box-shadow:inset 0 -3px var(--color-primary);} .request-tabs span {border-radius:var(--radius-pill);padding:0 var(--space-2);background:var(--color-surface);color:var(--color-text);} @media(pointer:coarse){.request-tabs button{min-height:44px;}}</style>