<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type Requirement = {
		name: string; description?: string; in_person: boolean;
		file_path: string | null; file_name: string | null;
		submitted_at: string | null; needs_correction: boolean;
	};

	const req = data.request as {
		request_id: string; document_name: string; student_name: string;
		student_code: string; program: string; student_type: string;
		student_email: string; last_school_year: number | null;
		purpose: string; status: string; requirements: Requirement[];
		admin_message: string | null; approved_file_path: string | null;
		approved_file_name: string | null; date_requested: string;
	};
	const history = data.history as Array<{
		old_status: string | null; new_status: string; changed_at: string; changed_by_name: string | null;
	}>;

	// Modal state
	let correctionOpen = $state(false);
	let rejectOpen = $state(false);
	let approveOpen = $state(false);
	let submitting = $state(false);
	let actionError = $state('');
	let toastMessage = $state('');

	// Action form state
	let adminMessage = $state('');
	let approvedFile = $state<File | null>(null);
	let flagged = $state<Record<string, boolean>>({});

	let currentStatus = $state(req.status);

	function showToast(msg: string) {
		toastMessage = msg;
		setTimeout(() => toastMessage = '', 4000);
	}

	async function getSignedUrl(bucket: string, path: string): Promise<string> {
		const res = await fetch(`/api/storage?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`);
		const data = await res.json();
		return data.url ?? '';
	}

	async function openFile(path: string) {
		const url = await getSignedUrl('requirements', path);
		if (url) window.open(url, '_blank');
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
			if (!res.ok) { actionError = result.error ?? 'Action failed.'; return; }

			currentStatus = result.new_status;
			correctionOpen = rejectOpen = approveOpen = false;
			adminMessage = '';
			approvedFile = null;
			flagged = {};
			const label = action === 'correction' ? 'Correction requested' : action === 'approve' ? 'Request approved' : 'Request rejected';
			// The status change succeeded even if the notification email didn't — say so.
			showToast(result.email_warning ? `${label} — but the email failed to send` : `${label} — ${req.request_id}`);
			if (result.email_warning) actionError = result.email_warning;
		} catch {
			actionError = 'Network error.';
		} finally {
			submitting = false;
		}
	}
</script>

<!-- Toast -->
{#if toastMessage}
	<div class="fixed bottom-6 right-6 z-50 bg-gray-800 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in">
		<i class="fa-solid fa-circle-check text-green-400"></i>
		{toastMessage}
	</div>
{/if}

<div class="max-w-4xl mx-auto space-y-5">
	<!-- Back + header -->
	<div class="flex items-center gap-3">
		<a href="/staff/requests" class="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
			<i class="fa-solid fa-arrow-left text-gray-600 text-sm"></i>
		</a>
		<div class="flex-1">
			<div class="flex items-center gap-3">
				<h2 class="text-lg font-semibold text-gray-800 font-mono">{req.request_id}</h2>
				<Badge value={currentStatus.toLowerCase()} />
			</div>
			<p class="text-xs text-gray-400 mt-0.5">
				Submitted {new Date(req.date_requested).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
					<div><p class="text-xs text-gray-400 mb-0.5">Document</p><p class="font-medium">{req.document_name}</p></div>
					<div class="col-span-2"><p class="text-xs text-gray-400 mb-0.5">Purpose</p><p class="font-medium">{req.purpose}</p></div>
					{#if req.admin_message}
						<div class="col-span-2">
							<p class="text-xs text-gray-400 mb-0.5">Staff Message</p>
							<p class="text-sm text-gray-700 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">{req.admin_message}</p>
						</div>
					{/if}
				</div>
			</div>

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
								{#if r.in_person}
									<p class="text-xs text-orange-600 mt-0.5"><i class="fa-solid fa-building mr-1"></i>In-person submission required</p>
								{:else if r.submitted_at}
									<p class="text-xs text-gray-400 mt-0.5">
										Submitted {new Date(r.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })} · {r.file_name}
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
			{#if currentStatus === 'Pending' || currentStatus === 'Correction Requested'}
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
							<p class="text-xs text-gray-400">{new Date(req.date_requested).toLocaleDateString('en-PH')}</p>
						</div>
					</div>
					{#each history as h}
						<div class="flex items-start gap-3 text-sm">
							<div class="w-2 h-2 rounded-full bg-gray-300 mt-1.5 shrink-0"></div>
							<div>
								<p class="font-medium text-gray-700">{h.old_status} → {h.new_status}</p>
								<p class="text-xs text-gray-400">
									{new Date(h.changed_at).toLocaleDateString('en-PH')}
									{h.changed_by_name ? `· by ${h.changed_by_name}` : ''}
								</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Approve Modal -->
<Modal open={approveOpen} title="Approve Request" size="sm" onclose={() => approveOpen = false}>
	{#snippet body()}
		<div class="space-y-4">
			{#if actionError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{actionError}</div>
			{/if}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">
					Upload Requested Document <span class="text-red-500">*</span>
				</label>
				<label class="flex items-start gap-3 px-3 py-3 border border-gray-200 border-dashed rounded-lg cursor-pointer hover:border-essu-green/50 hover:bg-essu-green/5 transition-all">
					<i class="fa-solid fa-upload text-gray-400 shrink-0 mt-0.5"></i>
					<span class="text-sm min-w-0 break-words {approvedFile ? 'text-essu-green font-medium' : 'text-gray-400'}">
						{approvedFile ? approvedFile.name : 'Click to upload the requested document'}
					</span>
					<input type="file" accept=".pdf,.doc,.docx,image/*" class="hidden" onchange={(e) => {
						const f = (e.target as HTMLInputElement).files?.[0];
						if (f) approvedFile = f;
					}} />
				</label>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Note to student <span class="text-gray-400 font-normal">(optional)</span></label>
				<textarea bind:value={adminMessage} rows="2" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-essu-green/30" placeholder="Optional message..."></textarea>
			</div>
		</div>
	{/snippet}
	{#snippet footer()}
		<button onclick={() => approveOpen = false} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
		<button onclick={() => submitAction('approve')} disabled={submitting || !approvedFile} class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid disabled:opacity-60 flex items-center gap-2">
			{#if submitting}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
			Approve & Send
		</button>
	{/snippet}
</Modal>

<!-- Request Correction Modal -->
<Modal open={correctionOpen} title="Request Correction" size="sm" onclose={() => correctionOpen = false}>
	{#snippet body()}
		<div class="space-y-4">
			{#if actionError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{actionError}</div>
			{/if}
			<div>
				<p class="text-sm font-medium text-gray-700 mb-2">Flag requirements needing correction:</p>
				<div class="space-y-2">
					{#each req.requirements.filter(r => !r.in_person) as r}
						<label class="flex items-center gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50">
							<input type="checkbox" bind:checked={flagged[r.name]} class="accent-yellow-500" />
							<span class="text-sm text-gray-700">{r.name}</span>
						</label>
					{/each}
				</div>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Message to student <span class="text-red-500">*</span></label>
				<textarea bind:value={adminMessage} rows="3" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-essu-green/30" placeholder="Explain what corrections are needed..."></textarea>
			</div>
		</div>
	{/snippet}
	{#snippet footer()}
		<button onclick={() => correctionOpen = false} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
		<button onclick={() => submitAction('correction')} disabled={submitting || !adminMessage.trim()} class="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-60 flex items-center gap-2">
			{#if submitting}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
			Send Correction Request
		</button>
	{/snippet}
</Modal>

<!-- Reject Modal -->
<Modal open={rejectOpen} title="Reject Request" size="sm" onclose={() => rejectOpen = false}>
	{#snippet body()}
		<div class="space-y-4">
			{#if actionError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{actionError}</div>
			{/if}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Reason for rejection <span class="text-red-500">*</span></label>
				<textarea bind:value={adminMessage} rows="3" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-essu-green/30" placeholder="Explain why this request is being rejected..."></textarea>
			</div>
		</div>
	{/snippet}
	{#snippet footer()}
		<button onclick={() => rejectOpen = false} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
		<button onclick={() => submitAction('reject')} disabled={submitting || !adminMessage.trim()} class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-2">
			{#if submitting}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
			Reject Request
		</button>
	{/snippet}
</Modal>
