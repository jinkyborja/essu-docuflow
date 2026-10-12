<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import RequestJourney from '$lib/components/ui/RequestJourney.svelte';
	import { formatDate, type JourneyEvent } from '$lib/request-flow';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	type RequestItem = { document_id: number; name: string };
	type DashboardRequest = { history?: JourneyEvent[]; completed_at?: string | null; approved_file_path?: string | null; request_id: string; document_name: string; items: RequestItem[]; status: string; date_requested: string };
	const activeRequests = $derived((data.requests as DashboardRequest[]).filter(req => !req.completed_at).sort((a,b) => Number(b.status === 'Correction Requested') - Number(a.status === 'Correction Requested')));
	const locked = $derived(data.layoutUser.idStatus !== 'verified');
	const lockReason = 'Available after your ID is verified';
	const nextStep = $derived(data.layoutUser.idStatus === 'verified' ? 'Choose Request Document to start.' : data.layoutUser.idStatus === 'rejected' ? 'Upload a new ID photo, then resubmit.' : 'Wait for the office to finish reviewing. You can browse Forms meanwhile.');
	const recentNotifs = $derived(data.recentHistory.map(h => ({
		id: String(h.history_id),
		title: h.request_id ? `${h.document_name ?? 'Document request'}: ${h.new_status}` : String(h.new_status),
		date: formatDate(h.changed_at)
	})));
</script>

<div class="student-dashboard">
	{#if activeRequests.length === 0}
		<Card class="dashboard-hero">
			<div class="hero-icon" aria-hidden="true"><i class="fa-solid fa-file-circle-plus"></i></div>
			<div class="hero-copy"><h2>Request a document</h2><p>Choose your documents and submit their requirements. Track updates here.</p></div>
			<Button href="/student/request" icon={locked ? 'fa-solid fa-lock' : 'fa-solid fa-plus'} disabled={locked} disabledReason={locked ? lockReason : undefined}>Request a document</Button>
		</Card>
	{:else}
		{#each activeRequests as req (req.request_id)}
			<Card class="active-request-card">
				<div class="request-heading"><div class="hero-copy"><p class="eyebrow">Active request</p><h2>{req.items?.length ? req.items.map(item => item.name).join(' / ') : req.document_name}</h2><p class="request-meta">{req.request_id} · {formatDate(req.date_requested)}</p></div><StatusChip value={req.status} /></div>
				<RequestJourney status={req.status} dateRequested={req.date_requested} history={req.history} hasFile={!!req.approved_file_path} completed={!!req.completed_at} compact />
				{#snippet footer()}<Button href={'/student/documents#' + req.request_id} icon="fa-solid fa-arrow-right" iconRight>Track request</Button>{/snippet}
			</Card>
		{/each}
	{/if}
	<div class="dashboard-support">
		<Card title="Your next step"><p class="next-step-copy">{nextStep}</p></Card>
		<Card class="recent-notifications">
			<div class="section-heading"><h2>Recent notifications</h2><Button variant="ghost" href="/student/notifications" icon="fa-solid fa-arrow-right" iconRight>View all</Button></div>
			{#if recentNotifs.length === 0}<p class="muted">No notifications yet. Office updates will appear here.</p>
			{:else}<ul>{#each recentNotifs as notif (notif.id)}<li><a href="/student/notifications"><i class="fa-regular fa-bell" aria-hidden="true"></i><span><span class="notification-title">{notif.title}</span><span class="notification-date">{notif.date}</span></span></a></li>{/each}</ul>{/if}
		</Card>
	</div>
</div>

<style>
	.student-dashboard { display: flex; flex-direction: column; gap: var(--space-6); }
	h2 { margin: 0; color: var(--color-text); font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); line-height: var(--line-height); }
	p { margin: 0; }
	:global(.dashboard-hero.ui-card) { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-6); }
	.hero-icon { display: grid; place-items: center; width: var(--space-12); height: var(--space-12); border-radius: var(--radius-control); background: var(--color-primary-soft); color: var(--color-primary); font-size: var(--font-size-page-title); }
	.hero-copy { flex: 1; min-width: 0; }
	.hero-copy > p { margin-top: var(--space-2); color: var(--color-text-muted); font-size: var(--font-size-body); }
	.hero-copy > .eyebrow, .hero-copy > .request-meta { font-size: var(--font-size-helper); }
	.hero-copy > .eyebrow { margin: 0 0 var(--space-1); }
	.request-heading { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-6); }
	.dashboard-support { display: grid; gap: var(--space-6); }
	.next-step-copy, .muted { color: var(--color-text-muted); font-size: var(--font-size-body); line-height: var(--line-height); }
	.section-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); }
	ul { margin: 0; padding: 0; list-style: none; }
	li + li { border-top: 1px solid var(--color-border); }
	li a { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-2); border-radius: var(--radius-control); color: var(--color-text); text-decoration: none; transition: background-color var(--motion-fast); }
	li a:hover { background: var(--color-primary-soft); }
	li i { color: var(--color-primary); font-size: var(--font-size-card-title); }
	.notification-title { display: block; font-size: var(--font-size-body); font-weight: var(--font-weight-medium); }
	.notification-date { display: block; margin-top: var(--space-1); color: var(--color-text-muted); font-size: var(--font-size-helper); }
	@media (min-width: 1024px) { .dashboard-support { grid-template-columns: 1fr 1fr; } }
	@media (max-width: 639px) { .hero-copy { flex-basis: 100%; } }
</style>
