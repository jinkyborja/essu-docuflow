<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type Requirement = {
		name: string; description?: string; in_person: boolean;
		file_path: string | null; file_name: string | null;
		submitted_at: string | null; needs_correction: boolean;
	};
	type RequestRow = {
		request_id: string; document_name: string; purpose: string; status: string;
		admin_message: string | null; approved_file_path: string | null;
		approved_file_name: string | null; requirements: string | null; date_requested: string;
		items: Array<{document_id:number;name:string}>;
	};

	// Override list after resubmit refresh; null means use server data
	let requestsOverride = $state<RequestRow[] | null>(null);
	const requests = $derived((requestsOverride ?? data.requests) as RequestRow[]);

	// Resubmit modal
	let resubmitOpen = $state(false);
	let resubmitReq = $state<RequestRow | null>(null);
	let resubmitFiles = $state<Record<string, File | null>>({});
	let resubmitting = $state(false);
	let resubmitError = $state('');
	let toastMsg = $state('');
	let expandedItems = $state<string[]>([]);

	function parseReqs(json: string | null): Requirement[] {
		if (!json) return [];
		try { return JSON.parse(json); } catch { return []; }
	}

	function openResubmit(r: RequestRow) {
		resubmitReq = r;
		resubmitFiles = {};
		resubmitError = '';
		resubmitOpen = true;
	}

	function showToast(msg: string) {
		toastMsg = msg;
		setTimeout(() => toastMsg = '', 4000);
	}

	async function getSignedUrl(path: string): Promise<string> {
		const res = await fetch(`/api/storage?bucket=requirements&path=${encodeURIComponent(path)}`);
		const d = await res.json();
		return d.url ?? '';
	}

	async function openFile(path: string) {
		const url = await getSignedUrl(path);
		if (url) window.open(url, '_blank');
	}

	async function downloadFile(path: string, name: string) {
		const url = await getSignedUrl(path);
		if (!url) return;
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
	}

	async function submitResubmission() {
		if (!resubmitReq) return;
		resubmitting = true;
		resubmitError = '';
		try {
			const fd = new FormData();
			const reqs = parseReqs(resubmitReq.requirements);
			for (const r of reqs) {
				if (!r.in_person && resubmitFiles[r.name]) {
					fd.append(`file_${r.name}`, resubmitFiles[r.name]!);
				}
			}
			const res = await fetch(`/api/requests/${resubmitReq.request_id}/requirements`, {
				method: 'PATCH', body: fd
			});
			const result = await res.json();
			if (!res.ok) { resubmitError = result.error ?? 'Resubmission failed.'; return; }

			// Refresh data
			const listRes = await fetch('/api/requests');
			requestsOverride = await listRes.json();
			resubmitOpen = false;
			showToast('Requirements resubmitted successfully.');
		} catch {
			resubmitError = 'Network error.';
		} finally {
			resubmitting = false;
		}
	}
</script>

<!-- Toast -->
{#if toastMsg}
	<div class="fixed bottom-6 right-6 z-50 bg-gray-800 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
		<i class="fa-solid fa-circle-check text-green-400"></i>
		{toastMsg}
	</div>
{/if}

<div class="space-y-5">
	<div>
		<h2 class="text-lg font-semibold text-gray-800">My Document Requests</h2>
		<p class="text-sm text-gray-500 mt-0.5">Track the status of your document requests.</p>
	</div>

	{#if requests.length === 0}
		<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
			<i class="fa-solid fa-folder-open text-4xl text-gray-200 mb-4 block"></i>
			<p class="text-gray-500 text-sm mb-3">No requests yet.</p>
			<a href="/student/request" class="inline-flex items-center gap-2 px-4 py-2 bg-essu-green text-white rounded-lg text-sm hover:bg-essu-green-mid transition-colors">
				<i class="fa-solid fa-plus text-xs"></i> Request a Document
			</a>
		</div>
	{:else}
		<div class="space-y-4">
			{#each requests as req}
				{@const reqs = parseReqs(req.requirements)}
				{@const needsCorrection = req.status === 'Correction Requested'}
				{@const canResubmit = needsCorrection || req.status === 'Pending'}
				<div class="bg-white rounded-xl border border-gray-100 shadow-sm {needsCorrection ? 'border-yellow-300' : ''}">
					<div class="px-4 sm:px-5 py-4 flex items-start justify-between gap-3 flex-wrap border-b border-gray-100">
						<div class="min-w-0">
							<div class="flex items-center gap-2 mb-1 flex-wrap">
								<p class="font-semibold text-gray-800">{req.document_name}{#if (req.items?.length ?? 0) > 1}<button type="button" class="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-essu-green" onclick={() => expandedItems = expandedItems.includes(req.request_id) ? expandedItems.filter((id) => id !== req.request_id) : [...expandedItems, req.request_id]}>+{req.items.length - 1} more</button>{/if}</p>
								{#if expandedItems.includes(req.request_id)}<p class="mt-1 text-xs text-gray-500">{req.items.map((item) => item.name).join(', ')}</p>{/if}
								<Badge value={req.status.toLowerCase()} />
							</div>
							<p class="text-xs text-gray-400 font-mono break-all">{req.request_id} · {new Date(req.date_requested).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
						</div>
						{#if canResubmit}
							<button
								onclick={() => openResubmit(req)}
								class="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
									{needsCorrection ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}"
							>
								<i class="fa-solid fa-rotate-left"></i>
								{needsCorrection ? 'Resubmit' : 'Update Files'}
							</button>
						{/if}
					</div>

					<div class="px-4 sm:px-5 py-4 space-y-3 text-sm">
						<div>
							<p class="text-xs text-gray-400 mb-0.5">Purpose</p>
							<p class="text-gray-700">{req.purpose}</p>
						</div>

						{#if req.admin_message}
							<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
								<p class="text-xs font-semibold text-yellow-700 mb-1">
									<i class="fa-solid fa-message mr-1"></i>Message from Registrar
								</p>
								<p class="text-sm text-yellow-800">{req.admin_message}</p>
							</div>
						{/if}

						{#if reqs.length > 0}
							<div>
								<p class="text-xs text-gray-400 mb-2">Requirements</p>
								<div class="space-y-1">
									{#each reqs as r}
										<div class="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
											<div class="flex items-center gap-2 min-w-0">
												{#if r.needs_correction}
													<i class="fa-solid fa-triangle-exclamation text-yellow-500 text-xs shrink-0"></i>
												{:else if r.in_person}
													<i class="fa-solid fa-building text-orange-400 text-xs shrink-0"></i>
												{:else if r.file_path}
													<i class="fa-solid fa-circle-check text-green-500 text-xs shrink-0"></i>
												{:else}
													<i class="fa-regular fa-circle text-gray-300 text-xs shrink-0"></i>
												{/if}
												<span class="text-xs text-gray-700 truncate {r.needs_correction ? 'text-yellow-700 font-medium' : ''}">{r.name}</span>
											</div>
											<div class="flex items-center gap-2 shrink-0">
												{#if r.in_person}
													<span class="text-xs text-orange-500">In-person</span>
												{:else if r.file_path}
													<button onclick={() => openFile(r.file_path!)} class="text-xs text-essu-green hover:underline">View</button>
												{:else}
													<span class="text-xs text-gray-400">Pending</span>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if req.approved_file_path}
							<div class="p-3 bg-green-50 border border-green-200 rounded-lg">
								<p class="text-xs font-semibold text-green-700 mb-2">
									<i class="fa-solid fa-circle-check mr-1"></i>Document Ready
								</p>
								<div class="flex flex-wrap items-center gap-2">
									<p class="text-sm text-gray-700 flex-1 truncate min-w-0 basis-full sm:basis-auto">{req.approved_file_name ?? 'Document'}</p>
									<button
										onclick={() => openFile(req.approved_file_path!)}
										class="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-essu-green/30 text-essu-green hover:bg-essu-green hover:text-white transition-colors text-xs"
										title="View"
									>
										<i class="fa-solid fa-eye"></i> View
									</button>
									<button
										onclick={() => downloadFile(req.approved_file_path!, req.approved_file_name ?? 'document')}
										class="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-essu-green/30 text-essu-green hover:bg-essu-green hover:text-white transition-colors text-xs"
										title="Download"
									>
										<i class="fa-solid fa-download"></i> Download
									</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Resubmit Modal -->
<Modal open={resubmitOpen} title="Resubmit Requirements" size="sm" onclose={() => resubmitOpen = false}>
	{#snippet body()}
		{#if resubmitReq}
			{@const reqs = parseReqs(resubmitReq.requirements)}
			<div class="space-y-4">
				{#if resubmitReq.admin_message}
					<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
						<strong>Staff message:</strong> {resubmitReq.admin_message}
					</div>
				{/if}
				{#if resubmitError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{resubmitError}</div>
				{/if}
				<p class="text-sm text-gray-600">Upload corrected files for the flagged requirements:</p>
				<div class="space-y-3">
					{#each reqs.filter(r => !r.in_person) as r}
						<div class="border border-gray-100 rounded-lg p-3 {r.needs_correction ? 'border-yellow-300 bg-yellow-50/30' : ''}">
							<div class="flex items-center gap-2 mb-2">
								{#if r.needs_correction}
									<i class="fa-solid fa-triangle-exclamation text-yellow-500 text-xs"></i>
								{/if}
								<p class="text-sm font-medium text-gray-700 {r.needs_correction ? 'text-yellow-700' : ''}">{r.name}</p>
							</div>
							<label class="flex items-start gap-2 px-3 py-2 border border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-essu-green/50 text-sm {resubmitFiles[r.name] ? 'text-essu-green' : 'text-gray-400'}">
								<i class="fa-solid fa-upload text-xs shrink-0 mt-1"></i>
								<span class="min-w-0 break-words">
									{resubmitFiles[r.name] ? resubmitFiles[r.name]!.name : (r.file_name ? `Replace: ${r.file_name}` : 'Upload PDF or image')}
								</span>
								<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*" class="hidden" onchange={(e) => {
									const f = (e.target as HTMLInputElement).files?.[0];
									resubmitFiles = { ...resubmitFiles, [r.name]: f ?? null };
								}} />
							</label>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/snippet}
	{#snippet footer()}
		<button onclick={() => resubmitOpen = false} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
		<button onclick={submitResubmission} disabled={resubmitting} class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid disabled:opacity-60 flex items-center gap-2">
			{#if resubmitting}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
			Resubmit
		</button>
	{/snippet}
</Modal>
