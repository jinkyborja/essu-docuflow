<script lang="ts">
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import RequestJourney from '$lib/components/ui/RequestJourney.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type RequestItem = { document_id: number; name: string };
	type DashboardRequest = { completed_at?: string | null; approved_file_path?: string | null; request_id: string; document_name: string; items: RequestItem[]; status: string; date_requested: string };
	const activeRequests = $derived((data.requests as DashboardRequest[]).filter(req => !req.completed_at).sort((a,b) => Number(b.status === 'Correction Requested') - Number(a.status === 'Correction Requested')));
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

</script>
<div class="space-y-8">
 {#if activeRequests.length === 0}<Card title="Request a document" description="Choose your documents and upload the required files to get started."><p class="text-gray-500">{data.layoutUser.program}</p>{#snippet footer()}{#if locked}<button type="button" class="locked-request" aria-disabled="true" aria-label={'Request a document. '+lockReason} title={lockReason}><i class="fa-solid fa-lock" aria-hidden="true"></i>Request a document</button>{:else}<Button href="/student/request" icon="fa-solid fa-plus">Request a document</Button>{/if}{/snippet}</Card>{:else}{#each activeRequests as req}<Card title={req.items?.length ? req.items.map(item=>item.name).join(', '):req.document_name}><div class="flex flex-wrap items-center gap-3"><StatusChip value={req.status}/><p class="text-xs text-gray-500">{req.request_id} · {new Date(req.date_requested).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Manila'})}</p></div><div class="mt-6"><RequestJourney status={req.status} dateRequested={req.date_requested} hasFile={!!req.approved_file_path} completed={!!req.completed_at} compact /></div>{#snippet footer()}<Button href={'/student/documents#'+req.request_id} icon="fa-solid fa-arrow-right" iconRight>Track request</Button>{/snippet}</Card>{/each}{/if}
 <div class="dashboard-secondary"><div class="next-step-panel rounded-xl border border-gray-200 p-6"><h2 class="text-xl font-semibold">Your next step</h2><p class="mt-2 text-gray-600">{nextStep}</p></div><Card title="Recent notifications">{#if !recentNotifs.length}<p class="text-gray-500">No notifications yet. Office updates will appear here.</p>{:else}<ul class="space-y-4">{#each recentNotifs as notif}<li><p class="font-medium">{notif.title}</p><p class="text-xs text-gray-500">{notif.date}</p></li>{/each}</ul>{/if}{#snippet footer()}<Button variant="ghost" href="/student/notifications">View all</Button>{/snippet}</Card></div>
</div>
<style>.dashboard-secondary {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--space-6);align-items:start;} .locked-request {display:inline-flex;align-items:center;gap:var(--space-2);height:40px;padding:0 var(--space-4);border:1px solid var(--color-primary);border-radius:var(--radius-control);color:var(--color-primary);font-weight:var(--weight-semibold);} .locked-request:hover {background:var(--color-primary-soft);} @media(max-width:767px){.dashboard-secondary {grid-template-columns:1fr;}} @media(pointer:coarse){.locked-request {height:44px;}}</style>
