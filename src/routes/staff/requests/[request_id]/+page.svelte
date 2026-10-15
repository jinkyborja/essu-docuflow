<script lang="ts">
	import {invalidateAll} from '$app/navigation';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { showToast } from '$lib/stores/toasts';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { statusLabel, requestStatusKey } from '$lib/request-status';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type Requirement = {
		form_id?: number | null; needs_signature?: boolean | null; signature_note?: string | null;
		form_title?: string | null; form_files?: Array<{ public_url: string; name: string; page_no: number }>;
		name: string; description?: string; in_person: boolean;
		file_path: string | null; file_name: string | null;
		submitted_at: string | null; needs_correction: boolean;
	};

	const req = $derived(data.request as {
		request_id: string; document_name: string; student_name: string;
		items: Array<{ document_id: number; name: string }>;
		student_code: string; program: string; student_type: string;
		student_email: string; last_school_year: number | null;
		purpose: string; status: string; archived_at?: string | null; requirements: Requirement[];
		admin_message: string | null; approved_file_path: string | null;
		approved_file_name: string | null; date_requested: string;
		decided_at: string | null; decision_recorded: boolean; decision_actor_name: string | null;
		decision_actor_role: string | null; decision_action: string | null;
	});
	const history = $derived(data.history as Array<{
		old_status: string | null; new_status: string; changed_at: string; changed_by_name: string | null; changed_by_role: string | null;
	}>);

	// Modal state
	let correctionOpen = $state(false);
	let rejectOpen = $state(false);
	let approveOpen = $state(false);
	let submitting = $state(false);
	let actionError = $state('');
	let deliveryConfirm = $state(false);

	// Action form state
	let adminMessage = $state('');
	let approvedFile = $state<File | null>(null);
	let flagged = $state<Record<string, boolean>>({});

	let currentStatus = $state(req.status);
	$effect(() => { currentStatus = req.status; });
	let deliveryOverride = $state(false);
	const delivered = $derived(deliveryOverride || requestStatusKey(currentStatus) === 'released' || history.some(event => requestStatusKey(event.new_status) === 'released'));
	const hasDecision = $derived(req.decision_recorded || !!req.decided_at || ['Approved', 'Rejected', 'Correction Requested'].includes(req.status));
	function decisionLabel() {
		if (req.decision_action === 'request.approved') return 'Approved';
		if (req.decision_action === 'request.rejected') return 'Rejected';
		if (req.decision_action === 'request.correction_requested') return 'Corrections requested';
		if (req.status === 'Approved' || req.status === 'Rejected' || req.status === 'Correction Requested') return req.status === 'Correction Requested' ? 'Corrections requested' : req.status;
		return 'Decision';
	}
	function decisionDate(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return 'Not recorded';
		const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
		const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
		return `${day} at ${time}`;
	}
	async function recordDelivery() {
		if (!deliveryConfirm || submitting) return;
		submitting = true; actionError = '';
		try {
			const res = await fetch('/api/requests/' + req.request_id + '/complete', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:true})});
			const data = await res.json();
			if (!res.ok) { actionError = data.error ?? 'Could not mark the request as released.'; showToast(actionError, 'error'); return; }
			deliveryConfirm = false; deliveryOverride = true; showToast('Request marked as released.'); await invalidateAll();
		} catch { actionError = 'Could not mark the request as released.'; showToast(actionError, 'error'); } finally { submitting = false; }
	}



	async function getSignedUrl(bucket: string, path: string): Promise<string> {
		const res = await fetch(`/api/storage?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`);
		const data = await res.json();
		return data.url ?? '';
	}

	async function openFile(path: string) {
		const preview = window.open('about:blank', '_blank');
		if (!preview) { showToast('Allow pop-ups to view this file.', 'error'); return; }
		preview.opener = null;
		try { const url = await getSignedUrl('requirements', path); if (!url) throw new Error('Could not open this file.'); preview.location.replace(url); showToast('File opened.'); }
		catch (error) { preview.close(); showToast((error as Error).message, 'error'); }
	}

	async function submitAction(action: 'approve' | 'reject' | 'correction') {
		submitting = true;
		actionError = '';
		try {
			const fd = new FormData();
			fd.append('action', action);
			if (adminMessage) fd.append('admin_message', adminMessage);
			if (action === 'correction') {
				const flaggedNames = Object.entries(flagged).filter(([, v]) => v).map(([k]) => k);
				fd.append('flagged_requirements', JSON.stringify(flaggedNames));
			}
			if (action === 'approve' && approvedFile) fd.append('approved_file', approvedFile);

			const res = await fetch(`/api/requests/${req.request_id}`, { method: 'PATCH', body: fd });
			const result = await res.json();
			if (!res.ok) { actionError = result.error ?? 'Action failed.'; showToast(actionError, 'error'); return; }

			currentStatus = result.new_status;
			await invalidateAll();
			correctionOpen = rejectOpen = approveOpen = false;
			adminMessage = '';
			approvedFile = null;
			flagged = {};
			const label = action === 'correction' ? 'Correction requested' : action === 'approve' ? 'Request approved' : 'Request rejected';
			// The status change succeeded even if the notification email didn't — say so.
			showToast(result.email_warning ? `${label} — but the email failed to send` : `${label} — ${req.request_id}`);
			if (result.email_warning) actionError = result.email_warning;
		} catch {
			actionError = 'Network error.'; showToast(actionError, 'error');
		} finally {
			submitting = false;
		}
	}
</script>



<div class="w-full min-w-0 space-y-5">
	<!-- Back + header -->
	<div class="flex items-center gap-3">
		<a href="/staff/requests" aria-label="Back to All Requests" title="Back to All Requests" class="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
			<i class="fa-solid fa-arrow-left text-gray-600 text-sm"></i>
		</a>
		<div class="flex-1">
			<div class="flex items-center gap-3">
				<h2 class="text-lg font-semibold text-gray-800 font-mono">{req.request_id}</h2>
				<Badge value={currentStatus.toLowerCase()} />
			</div>
			<p class="text-xs text-gray-400 mt-0.5">
				Submitted {new Date(req.date_requested).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
			</p>
		</div>
	</div>

	<div class="grid grid-cols-1 xl:grid-cols-3 gap-5">
		<div class="xl:col-span-2 space-y-5">
			<!-- Student info -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700">Student Information</h3>
				</div>
				<div class="grid grid-cols-2 gap-4 p-5 text-sm">
					<div><p class="text-xs text-gray-400 mb-0.5">Full Name</p><p class="font-medium">{req.student_name}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Student ID</p><p class="font-medium font-mono">{req.student_code ?? '—'}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Program</p><p class="font-medium">{req.program ?? '—'}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Student Type</p><p class="font-medium">{req.student_type ?? '—'}</p></div>
					<div><p class="text-xs text-gray-400 mb-0.5">Email</p><p class="font-medium">{req.student_email}</p></div>
					{#if req.last_school_year}
						<div><p class="text-xs text-gray-400 mb-0.5">Last School Year</p><p class="font-medium">{req.last_school_year}</p></div>
					{/if}
				</div>
			</div>

			<!-- Request info -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700">Request Details</h3>
				</div>
				<div class="grid grid-cols-2 gap-4 p-5 text-sm">
					<div><p class="text-xs text-gray-400 mb-0.5">Documents</p><ul class="space-y-1">{#each req.items ?? [] as item}<li class="font-medium">{item.name}</li>{/each}</ul></div>
					<div class="col-span-2"><p class="text-xs text-gray-400 mb-0.5">Purpose</p><p class="font-medium">{req.purpose}</p></div>
					{#if req.admin_message}
						<div class="col-span-2">
							<p class="text-xs text-gray-400 mb-0.5">Staff Message</p>
							<p class="text-sm text-gray-700 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">{req.admin_message}</p>
						</div>
					{/if}
				</div>
			</div>

			{#if hasDecision}
				<div class="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
					<h3 class="mb-2 font-semibold text-gray-700">Decision</h3>
					{#if req.decision_recorded}
						<p class="text-sm text-gray-700">{decisionLabel()} by {req.decision_actor_name || 'Former staff'} ({req.decision_actor_role || 'Staff'}) on {decisionDate(req.decided_at!)}</p>
					{:else}
						<p class="text-sm text-gray-500">Not recorded</p>
					{/if}
					{#if req.admin_message}<div class="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3"><p class="mb-1 text-xs font-semibold text-gray-500">Reason or note</p><p class="text-sm text-gray-700">{req.admin_message}</p></div>{/if}
				</div>
			{/if}

			<!-- Requirements -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700">Submitted Requirements</h3>
				</div>
				<div class="divide-y divide-gray-50">
					{#each req.requirements as r}
						<div class="px-5 py-4 flex items-center gap-4">
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<p class="text-sm font-medium text-gray-700">{r.name}</p>
									{#if r.needs_correction}
										<span class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-full">Needs Correction</span>
									{/if}
								</div>
								{#if r.form_id}
									<div class="mt-1 flex flex-wrap gap-2">
										{#each r.form_files ?? [] as file}<a href={file.public_url} target="_blank" rel="noopener noreferrer" class="text-xs text-essu-green hover:underline focus:outline-none focus:ring-2 focus:ring-essu-green/30">{r.form_title}: {file.name}</a>{/each}
									</div>
								{/if}
								{#if r.signature_note}<p class="mt-1 text-xs text-gray-600">{r.signature_note}</p>{:else if r.needs_signature}<p class="mt-1 text-xs text-gray-600">Signatures required.</p>{/if}
								{#if r.in_person}
									<p class="text-xs text-orange-600 mt-0.5"><i class="fa-solid fa-building mr-1"></i>In-person submission required</p>
								{:else if r.submitted_at}
									<p class="text-xs text-gray-400 mt-0.5">
										Submitted {new Date(r.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })} · {r.file_name}
									</p>
								{:else}
									<p class="text-xs text-gray-400 mt-0.5">Not yet submitted</p>
								{/if}
							</div>
							{#if !r.in_person && r.file_path}
								<button
									onclick={() => openFile(r.file_path!)}
									class="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-essu-green hover:bg-essu-green/5 transition-colors"
								>
									<i class="fa-solid fa-eye"></i> View
								</button>
							{/if}
						</div>
					{/each}
					{#if req.requirements.length === 0}
						<div class="px-5 py-4 text-sm text-gray-400">No requirements for this document.</div>
					{/if}
				</div>
			</div>

			<!-- Approved file -->
			{#if req.approved_file_path}
				<div class="bg-white rounded-xl border border-essu-green/30 shadow-sm p-5">
					<p class="text-sm font-semibold text-essu-green mb-2"><i class="fa-solid fa-circle-check mr-2"></i>Approved Document</p>
					<button
						onclick={() => openFile(req.approved_file_path!)}
						class="text-sm text-essu-green hover:underline flex items-center gap-2"
					>
						<i class="fa-solid fa-download"></i> {req.approved_file_name ?? 'Download document'}
					</button>
				</div>
			{/if}
		</div>

		<!-- Sidebar: actions + history -->
		<div class="space-y-4">
			<!-- Actions -->
			{#if req.archived_at}<p class="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Archived request. Original details and status history are retained.</p>{/if}
			{#if ['approved', 'ready_for_pickup'].includes(requestStatusKey(currentStatus) ?? '')}<div class="rounded-xl bg-white border border-essu-green/20 p-4 space-y-2"><p class="font-semibold text-sm text-essu-green">{delivered ? 'Released' : 'Ready for Release'}</p><p class="text-xs text-gray-600">{delivered ? 'The office confirmed the student collected the documents.' : 'The student can collect the approved document from the Graduate School office. Mark it as released after collection.'}</p>{#if !delivered && !req.archived_at}<button onclick={() => { actionError = ''; deliveryConfirm = true; }} disabled={submitting} class="px-3 py-2 rounded-lg bg-essu-green text-white text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30">Mark as released</button>{/if}</div>{/if}
			{#if actionError}<p role="alert" class="text-sm text-red-700">{actionError}</p>{/if}
			{#if !req.archived_at && (currentStatus === 'Pending' || currentStatus === 'Correction Requested')}
				<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
					<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</p>
					<button
						onclick={() => { actionError = ''; approveOpen = true; }}
						class="w-full flex items-center gap-2 px-4 py-2.5 bg-essu-green text-white rounded-lg text-sm font-medium hover:bg-essu-green-mid transition-colors"
					>
						<i class="fa-solid fa-circle-check"></i> Approve
					</button>
					<button
						onclick={() => { actionError = ''; correctionOpen = true; }}
						class="w-full flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-100 transition-colors"
					>
						<i class="fa-solid fa-rotate-left"></i> Request Correction
					</button>
					<button
						onclick={() => { actionError = ''; rejectOpen = true; }}
						class="w-full flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
					>
						<i class="fa-solid fa-circle-xmark"></i> Reject
					</button>
				</div>
			{/if}

			<!-- Status history -->
			<div class="bg-white rounded-xl border border-gray-100 shadow-sm">
				<div class="px-5 py-4 border-b border-gray-100">
					<h3 class="font-semibold text-gray-700 text-sm">Status History</h3>
				</div>
				<div class="p-4 space-y-3">
					<div class="flex items-start gap-3 text-sm">
						<div class="w-2 h-2 rounded-full bg-essu-green mt-1.5 shrink-0"></div>
						<div>
							<p class="font-medium text-gray-700">Request submitted</p>
							<p class="text-xs text-gray-400">{new Date(req.date_requested).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}</p>
							<p class="text-xs text-gray-400">by {req.student_name} (Student)</p>
						</div>
					</div>
					{#each history as h}
						<div class="flex items-start gap-3 text-sm">
							<div class="w-2 h-2 rounded-full bg-gray-300 mt-1.5 shrink-0"></div>
							<div>
								<p class="font-medium text-gray-700">{h.old_status ? statusLabel(h.old_status) : 'Submitted'} → {statusLabel(h.new_status)}</p>
								<p class="text-xs text-gray-400">
									{new Date(h.changed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
									· by {h.changed_by_name || 'Not recorded'}{h.changed_by_role ? ` (${h.changed_by_role})` : ''}
								</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

<ConfirmDialog open={approveOpen} title="Approve request" message={'Approve ' + req.request_id + ' for ' + req.student_name + '?'} variant="primary" confirmLabel="Approve & Send" loading={submitting} disabled={!approvedFile} disabledReason="Upload the requested document first" error={actionError} onclose={() => approveOpen = false} onconfirm={() => void submitAction('approve')}>
	{#snippet details()}<label class="block text-sm font-medium text-gray-700">Requested document (required)<input type="file" accept=".pdf,.doc,.docx,image/*" disabled={submitting} class="mt-2 block w-full text-sm" onchange={event => approvedFile = event.currentTarget.files?.[0] ?? null} /></label><label class="block text-sm text-gray-700">Note to student (optional)<textarea bind:value={adminMessage} rows="2" class="mt-2 w-full rounded-lg border border-gray-200 p-3 text-sm" disabled={submitting}></textarea></label>{/snippet}
</ConfirmDialog>
<ConfirmDialog open={correctionOpen} title="Request correction" message={'Request corrected requirements for ' + req.request_id + '?'} variant="primary" requireReason minLength={10} confirmLabel="Send correction request" loading={submitting} disabled={!Object.values(flagged).some(Boolean)} disabledReason="Select a requirement to correct" error={actionError} onclose={() => correctionOpen = false} onconfirm={reason => { adminMessage = reason; void submitAction('correction'); }}>
	{#snippet details()}<fieldset class="space-y-2"><legend class="mb-2 text-sm font-medium text-gray-700">Requirements needing correction</legend>{#each req.requirements.filter(requirement => !requirement.in_person) as requirement}<label class="flex items-center gap-3 rounded-lg border border-gray-200 p-3"><input type="checkbox" bind:checked={flagged[requirement.name]} disabled={submitting} class="accent-essu-green" /><span class="text-sm">{requirement.name}</span></label>{/each}</fieldset>{/snippet}
</ConfirmDialog>
<ConfirmDialog open={rejectOpen} title="Reject request" message={'Reject ' + req.request_id + ' for ' + req.student_name + '?'} requireReason minLength={10} confirmLabel="Reject request" loading={submitting} error={actionError} onclose={() => rejectOpen = false} onconfirm={reason => { adminMessage = reason; void submitAction('reject'); }} />
<ConfirmDialog open={deliveryConfirm} title="Mark as released" message={'Confirm that ' + req.student_name + ' has collected every document for ' + req.request_id + '?'} variant="primary" confirmLabel="Mark as released" loading={submitting} error={actionError} onclose={() => deliveryConfirm = false} onconfirm={() => void recordDelivery()} />
