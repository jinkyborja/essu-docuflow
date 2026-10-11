<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { canUpdateRequirementFiles, requirementNeedsCorrection } from '$lib/requirement-files';
	import { uploadRequirementFiles } from '$lib/upload-requirement-files';
	import { downloadStudentFile, studentFileUrl } from '$lib/student-files';
	import { documentRequirementGroups, type DocumentDefinition } from '$lib/student-request-display';
	import { showToast } from '$lib/stores/toasts';
	import { formatDate, type JourneyEvent } from '$lib/request-flow';
	import RequestJourney from '$lib/components/ui/RequestJourney.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import RequirementFilePicker from '$lib/components/ui/RequirementFilePicker.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import LoadError from '$lib/components/ui/LoadError.svelte';
	import type { PageData } from './$types';
	const { data }: { data: PageData } = $props();
	type Requirement = { form_id?: number | null; signature_note?: string | null; form_files?: Array<{ public_url: string; name: string }>; name: string; description?: string; in_person: boolean; file_path: string | null; file_name: string | null; submitted_at: string | null; needs_correction: boolean };
	type RequestRow = { history?: JourneyEvent[]; completed_at?: string | null; request_id: string; document_name: string; purpose: string; status: string; admin_message: string | null; approved_file_path: string | null; approved_file_name: string | null; requirements: Requirement[]; date_requested: string; items: Array<{ document_id: number; name: string }> };
	let requestsOverride = $state<RequestRow[] | null>(null);
	const requests = $derived((requestsOverride ?? data.requests) as RequestRow[]);
	const newestId = $derived([...requests].sort((a, b) => Date.parse(b.date_requested) - Date.parse(a.date_requested))[0]?.request_id);
	let catalog = $state<DocumentDefinition[]>([]);
	let catalogLoading = $state(true);
	let catalogError = $state('');
	let resubmitOpen = $state(false);
	let resubmitReq = $state<RequestRow | null>(null);
	let resubmitFiles = $state<Record<string, File | null>>({});
	let resubmitting = $state(false);
	let resubmitError = $state('');
	let fileBusy = $state<string | null>(null);
	let downloadBusy = $state<string | null>(null);
	let filePreviewOpen = $state(false);
	let filePreviewUrl = $state('');
	let filePreviewName = $state('');
	let refreshError = $state('');
	const missingCorrections = $derived(resubmitReq?.requirements.filter(req => !req.in_person && req.needs_correction && !resubmitFiles[req.name]).length ?? 0);
	const updateReason = $derived(missingCorrections ? `Upload ${missingCorrections} corrected ${missingCorrections === 1 ? 'file' : 'files'}` : 'Choose at least one replacement file');
	const canUpdate = $derived(!!Object.values(resubmitFiles).some(Boolean) && (!requirementNeedsCorrection(resubmitReq?.status ?? '') || missingCorrections === 0));
	onMount(() => { void loadCatalog(); });
	async function loadCatalog() {
		catalogLoading = true; catalogError = '';
		try { const response = await fetch('/api/documents'); const result = await response.json(); if (!response.ok || !Array.isArray(result)) throw new Error(result.error ?? 'Could not load document requirements.'); catalog = result; }
		catch (error) { catalogError = error instanceof Error ? error.message : 'Could not load document requirements.'; showToast(catalogError, 'error'); }
		finally { catalogLoading = false; }
	}
	async function openResubmit(req: RequestRow, name?: string) {
		if (resubmitting || !canUpdateRequirementFiles(req.status) || req.completed_at || req.history?.some(event => event.new_status === 'Completed')) return;
		resubmitReq = req; resubmitFiles = {}; resubmitError = ''; resubmitOpen = true;
		if (name) { await tick(); const input = document.getElementById('replace-' + encodeURIComponent(name))?.querySelector('input'); input?.focus(); }
	}
	async function openFile(path: string, name: string) {
		if (fileBusy) return;
		fileBusy = path;
		try { filePreviewUrl = await studentFileUrl(path); filePreviewName = name; filePreviewOpen = true; }
		catch (error) { showToast(error instanceof Error ? error.message : 'Could not open this file.', 'error'); }
		finally { fileBusy = null; }
	}
	async function downloadFile(path: string, name: string) {
		if (downloadBusy) return;
		downloadBusy = path;
		try { await downloadStudentFile(await studentFileUrl(path), name); showToast('Document downloaded.'); }
		catch (error) { showToast(error instanceof Error ? error.message : 'Could not download this document.', 'error'); }
		finally { downloadBusy = null; }
	}
	async function downloadForm(file: { public_url: string; name: string }) {
		if (downloadBusy) return;
		downloadBusy = file.public_url;
		try { await downloadStudentFile(file.public_url, file.name); showToast('Form downloaded.'); }
		catch (error) { showToast(error instanceof Error ? error.message : 'Could not download this form.', 'error'); }
		finally { downloadBusy = null; }
	}
	async function refreshRequests() {
		refreshError = '';
		try { const response = await fetch('/api/requests'); const result = await response.json(); if (!response.ok || !Array.isArray(result)) throw new Error(result.error ?? 'Could not refresh your requests.'); requestsOverride = result; }
		catch (error) { refreshError = error instanceof Error ? error.message : 'Could not refresh your requests.'; showToast(refreshError, 'error'); }
	}
	async function submitResubmission() {
		if (!resubmitReq || resubmitting || !canUpdate) return;
		resubmitting = true; resubmitError = '';
		try {
			const fd = new FormData();
			const uploadFiles = Object.fromEntries(resubmitReq.requirements.filter(req => !req.in_person).map(req => [req.name, resubmitFiles[req.name] ?? null]));
			fd.append('uploads', JSON.stringify(await uploadRequirementFiles(uploadFiles, { requestId: resubmitReq.request_id })));
			const response = await fetch('/api/requests/' + encodeURIComponent(resubmitReq.request_id) + '/requirements', { method: 'PATCH', body: fd });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? 'Could not update the files. Please try again.');
			resubmitOpen = false;
			showToast('Files updated and submitted for review.');
			await refreshRequests();
		} catch (error) { resubmitError = error instanceof Error ? error.message : 'Network error. Your selected files are still here.'; showToast(resubmitError, 'error'); }
		finally { resubmitting = false; }
	}
</script>

{#snippet requirementRow(req: RequestRow, item: Requirement, editable: boolean)}
	<div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-0">
		<div class="min-w-0 flex-1 basis-40"><p class="text-sm font-medium text-gray-800">{item.name}</p><p class="mt-1 break-words text-xs text-gray-500">{item.in_person ? 'Submit in person at the Graduate School' : item.file_name ?? 'No file uploaded'}</p></div>
		<StatusChip kind="file" value={item.needs_correction ? 'needs_correction' : item.in_person ? 'in_person' : item.file_path ? 'uploaded' : 'missing'} />
		{#if !item.in_person}<div class="flex items-center gap-2"><Button variant="secondary" size="sm" disabled={!item.file_path || !!fileBusy} disabledReason={!item.file_path ? 'No file uploaded yet' : undefined} loading={!!item.file_path && fileBusy === item.file_path} onclick={() => item.file_path && openFile(item.file_path, item.file_name ?? item.name)}>View</Button>{#if editable}<Button variant="secondary" size="sm" onclick={() => openResubmit(req, item.name)}>Replace</Button>{/if}</div>{/if}
	</div>
{/snippet}

<div class="space-y-5">
	{#if catalogLoading && requests.length}<LoadingState label="Loading document details…" />{/if}
	{#if refreshError}<div role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800"><p>Your files were saved. {refreshError} Refresh the list to see the latest status.</p><Button variant="secondary" onclick={refreshRequests}>Refresh requests</Button></div>{/if}
	{#if catalogError}<LoadError message="We couldn’t load document details. Your request requirements are listed below." onretry={loadCatalog} />{/if}
	{#if requests.length === 0}
		<div class="rounded-xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm"><i class="fa-solid fa-folder-open mb-4 block text-4xl text-gray-300" aria-hidden="true"></i><p class="mb-4 text-sm text-gray-600">No requests yet.</p><Button href="/student/request" icon="fa-solid fa-plus">Request a document</Button></div>
	{:else}
		{#each requests as req (req.request_id)}
			{@const completed = !!req.completed_at || !!req.history?.some(event => event.new_status === 'Completed')}
			{@const editable = !completed && canUpdateRequirementFiles(req.status)}
			{@const needsCorrection = requirementNeedsCorrection(req.status)}
			<article id={req.request_id} class="scroll-mt-24 rounded-xl border bg-white shadow-sm {needsCorrection ? 'border-yellow-300' : 'border-gray-100'}" aria-label={`Request ${req.request_id}`}>
				<header class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 p-4 sm:px-5"><div class="min-w-0"><h2 class="mb-2 text-sm font-semibold text-gray-800">Document request</h2><p class="mb-2 break-all font-mono text-xs text-gray-500">{req.request_id} · {formatDate(req.date_requested)}</p><StatusChip kind="request" value={completed ? 'completed' : req.status} /></div>{#if editable}<Button size="sm" icon="fa-solid fa-arrow-up-from-bracket" onclick={() => openResubmit(req)}>{needsCorrection ? 'Update files' : 'Manage files'}</Button>{:else if req.approved_file_path}<Button size="sm" icon="fa-solid fa-download" loading={downloadBusy === req.approved_file_path} disabled={!!downloadBusy} onclick={() => downloadFile(req.approved_file_path!, req.approved_file_name ?? 'document')}>Download document</Button>{/if}</header>
				<div class="space-y-4 p-4 sm:p-5">
					<RequestJourney status={req.status} dateRequested={req.date_requested} history={req.history} hasFile={!!req.approved_file_path} {completed} openByDefault={req.request_id === newestId} />
					<div><p class="text-xs text-gray-500">Purpose</p><p class="mt-1 text-sm text-gray-800">{req.purpose}</p></div>
					{#if req.admin_message}<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-3"><p class="mb-1 text-xs font-semibold text-yellow-800">Message from the Graduate School office</p><p class="text-sm text-yellow-900">{req.admin_message}</p></div>{/if}
					{#each documentRequirementGroups(req.items ?? [], req.requirements, catalog, req.document_name) as group}<section class="rounded-xl border border-gray-200 px-4 py-3" aria-label={group.name}><h3 class="text-sm font-semibold text-gray-800">{group.name}</h3>{#each group.requirements as item}{@render requirementRow(req, item, editable)}{:else}<p class="mt-2 text-xs text-gray-500">{catalogLoading ? 'Loading document requirements…' : catalogError ? 'See the request requirements below.' : 'No separate requirements for this document. Shared files are listed below.'}</p>{/each}</section>{/each}
					{#if req.approved_file_path}<section class="rounded-lg border border-green-200 bg-green-50 p-4"><h3 class="mb-2 text-sm font-semibold text-green-800">Document ready</h3><div class="flex flex-wrap items-center justify-between gap-3"><p class="min-w-0 flex-1 break-words text-sm text-gray-700">{req.approved_file_name ?? 'Document'}</p><Button variant="secondary" size="sm" loading={fileBusy === req.approved_file_path} disabled={!!fileBusy} onclick={() => openFile(req.approved_file_path!, req.approved_file_name ?? 'Document')}>View</Button></div></section>{/if}
				</div>
			</article>
		{/each}
	{/if}
</div>

<Modal open={resubmitOpen} title="Update requirement files" size="md" onclose={() => { if (!resubmitting) resubmitOpen = false; }}>
	{#snippet body()}{#if resubmitReq}<div class="space-y-4"><p class="text-sm text-gray-600">{requirementNeedsCorrection(resubmitReq.status) ? 'Replace every flagged file before submitting. Other files can stay as they are.' : 'Choose the files you want to replace. Existing files stay until the update succeeds.'}</p>{#if resubmitReq.admin_message}<p class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">{resubmitReq.admin_message}</p>{/if}{#if resubmitError}<p role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{resubmitError}</p>{/if}{#each resubmitReq.requirements.filter(item => !item.in_person) as item}<section id={'replace-' + encodeURIComponent(item.name)} class="scroll-mt-4 space-y-3 rounded-xl border p-4 {item.needs_correction ? 'border-yellow-300 bg-yellow-50/30' : 'border-gray-200'}"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-semibold text-gray-800">{item.name}</h3><StatusChip kind="file" value={item.needs_correction ? 'needs_correction' : item.file_path ? 'uploaded' : 'missing'} /></div><p class="break-words text-xs text-gray-500">Current file: {item.file_name ?? 'No file uploaded'}</p>{#if item.signature_note}<p class="text-xs text-gray-600">{item.signature_note}</p>{/if}{#each item.form_files ?? [] as file}<Button variant="secondary" size="sm" title={file.name} loading={downloadBusy === file.public_url} disabled={!!downloadBusy || resubmitting} onclick={() => downloadForm(file)}>Download form</Button>{/each}<RequirementFilePicker name={item.name} file={resubmitFiles[item.name] ?? null} disabled={resubmitting} onchange={(file) => resubmitFiles = { ...resubmitFiles, [item.name]: file }} /></section>{/each}</div>{/if}{/snippet}
	{#snippet footer()}<Button variant="secondary" disabled={resubmitting} onclick={() => resubmitOpen = false}>Cancel</Button><div class="text-right">{#if !canUpdate}<p class="mb-2 text-xs text-gray-600" aria-live="polite">{updateReason}</p>{/if}<Button loading={resubmitting} loadingLabel="Submitting…" disabled={!canUpdate} disabledReason={updateReason} onclick={submitResubmission}>Submit updated files</Button></div>{/snippet}
</Modal>
<Modal open={filePreviewOpen} title={filePreviewName} size="lg" onclose={() => filePreviewOpen = false}>{#snippet body()}<iframe src={filePreviewUrl} title={filePreviewName} class="h-[65vh] w-full rounded-lg border border-gray-200"></iframe>{/snippet}{#snippet footer()}<Button variant="secondary" onclick={() => filePreviewOpen = false}>Close</Button><Button href={filePreviewUrl} variant="secondary">Open file</Button>{/snippet}</Modal>
