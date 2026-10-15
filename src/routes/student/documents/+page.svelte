<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { canUpdateRequirementFiles, requirementNeedsCorrection } from '$lib/requirement-files';
	import { uploadRequirementFiles } from '$lib/upload-requirement-files';
	import { downloadStudentFile, studentFileUrl } from '$lib/student-files';
	import { documentRequirementGroups, type DocumentDefinition } from '$lib/student-request-display';
	import { showToast } from '$lib/stores/toasts';
	import { formatDate, type JourneyEvent } from '$lib/request-flow';
	import { requestStatusKey } from '$lib/request-status';
	import RequestJourney from '$lib/components/ui/RequestJourney.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import RequirementFilePicker from '$lib/components/ui/RequirementFilePicker.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import FilePreview from '$lib/components/ui/FilePreview.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import LoadError from '$lib/components/ui/LoadError.svelte';
	import type { PageData } from './$types';
	const { data }: { data: PageData } = $props();
	type Requirement = { form_id?: number | null; signature_note?: string | null; form_files?: Array<{ public_url: string; name: string }>; name: string; description?: string; in_person: boolean; file_path: string | null; file_name: string | null; submitted_at: string | null; needs_correction: boolean };
	type RequestRow = { archived_at?: string | null; history?: JourneyEvent[]; completed_at?: string | null; request_id: string; document_name: string; purpose: string; status: string; admin_message: string | null; approved_file_path: string | null; approved_file_name: string | null; requirements: Requirement[]; date_requested: string; items: Array<{ document_id: number; name: string }> };
	let requestsOverride = $state<RequestRow[] | null>(null);
	const requests = $derived((requestsOverride ?? data.requests) as RequestRow[]);
	$effect(() => { void data.requests; requestsOverride = null; });
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
	let filePreviewPath = $state('');
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
		if (resubmitting || req.archived_at || !canUpdateRequirementFiles(req.status) || req.completed_at || req.history?.some(event => event.new_status === 'Completed')) return;
		resubmitReq = req; resubmitFiles = {}; resubmitError = ''; resubmitOpen = true;
		if (name) { await tick(); const input = document.getElementById('replace-' + encodeURIComponent(name))?.querySelector('input'); input?.focus(); }
	}
	async function openFile(path: string, name: string) {
		filePreviewPath = path; filePreviewName = name; filePreviewOpen = true;
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
	<div class="requirement-file-row">
		<div class="min-w-0 flex-1 basis-40"><p class="text-sm font-medium text-gray-800">{item.name}</p><p class="mt-1 break-words text-xs text-gray-500">{item.in_person ? 'Submit in person at the Graduate School' : item.file_name ?? 'No file uploaded'}</p></div>
		<StatusChip kind="file" value={item.needs_correction ? 'needs_correction' : item.in_person ? 'in_person' : item.file_path ? 'uploaded' : 'missing'} />
		{#if !item.in_person}<div class="file-actions"><Button variant="ghost" icon="fa-solid fa-eye" disabled={!item.file_path} disabledReason={!item.file_path ? 'No file uploaded yet' : undefined} onclick={() => item.file_path && openFile(item.file_path, item.file_name ?? item.name)}>View</Button><Button variant="ghost" icon="fa-solid fa-download" loading={downloadBusy === item.file_path} disabled={!item.file_path || (!!downloadBusy && downloadBusy !== item.file_path)} disabledReason={!item.file_path ? 'No file uploaded yet' : undefined} onclick={() => item.file_path && downloadFile(item.file_path, item.file_name ?? item.name)}>Download</Button>{#if editable}<Button variant="ghost" icon="fa-solid fa-arrow-up-from-bracket" onclick={() => openResubmit(req, item.name)}>Replace</Button>{/if}</div>{/if}
	</div>
{/snippet}

<div class="space-y-6">
	{#if catalogLoading && requests.length}<LoadingState label="Loading document details…" />{/if}
	{#if refreshError}<div role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800"><p>Your files were saved. {refreshError} Refresh the list to see the latest status.</p><Button variant="secondary" onclick={refreshRequests}>Refresh requests</Button></div>{/if}
	{#if catalogError}<LoadError message="We couldn’t load document details. Your request requirements are listed below." onretry={loadCatalog} />{/if}
	{#if requests.length === 0}
		<Card><p class="mb-4 text-sm text-gray-600">No requests yet.</p><Button href="/student/request" icon="fa-solid fa-plus">Request a document</Button></Card>
	{:else}
		{#each requests as req (req.request_id)}
			{@const completed = requestStatusKey(req.status) === 'released' || !!req.completed_at || !!req.history?.some(event => event.new_status === 'Completed')}
			{@const editable = !completed && !req.archived_at && canUpdateRequirementFiles(req.status)}
			{@const needsCorrection = requirementNeedsCorrection(req.status)}
			{@const groups = documentRequirementGroups(req.items ?? [], req.requirements, catalog, req.document_name)}
			{@const fileRows = groups.flatMap(group => group.requirements).filter(item => !item.in_person)}
			<article id={req.request_id} class="document-request" aria-label={`Request ${req.request_id}`}>
				<Card class={needsCorrection ? 'document-request-card needs-correction' : 'document-request-card'}>
				<header class="request-header"><div class="request-heading"><h2>{req.items?.length ? req.items.map(item => item.name).join(' / ') : req.document_name}</h2><p class="request-meta">{req.request_id} · {formatDate(req.date_requested)}</p><div class="request-summary"><StatusChip kind="request" value={completed ? 'completed' : req.status} /><span class="upload-count">{catalogLoading ? 'Loading file totals…' : `${fileRows.filter(item => !!item.file_path).length} of ${fileRows.length} files uploaded`}</span></div></div>{#if editable}<Button icon="fa-solid fa-arrow-up-from-bracket" onclick={() => openResubmit(req)}>{needsCorrection ? 'Update files' : 'Manage files'}</Button>{:else if req.approved_file_path && ['approved', 'ready_for_pickup', 'released'].includes(requestStatusKey(req.status) ?? '')}<div class="file-actions"><Button variant="secondary" icon="fa-solid fa-eye" onclick={() => openFile(req.approved_file_path!, req.approved_file_name ?? 'Document')}>View</Button><Button icon="fa-solid fa-download" loading={downloadBusy === req.approved_file_path} disabled={!!downloadBusy} onclick={() => downloadFile(req.approved_file_path!, req.approved_file_name ?? 'document')}>Download document</Button></div>{:else}<Button href={'#timeline-' + req.request_id} icon="fa-solid fa-list-check">View timeline</Button>{/if}</header>
				<div class="request-body">
					<div id={'timeline-' + req.request_id} class="timeline-anchor"><RequestJourney status={req.status} dateRequested={req.date_requested} history={req.history} hasFile={!!req.approved_file_path} {completed} openByDefault={req.request_id === newestId} /></div>
					<div><p class="text-xs text-gray-500">Purpose</p><p class="mt-1 text-sm text-gray-800">{req.purpose}</p></div>
					{#if req.admin_message}<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-3"><p class="mb-1 text-xs font-semibold text-yellow-800">Message from the Graduate School office</p><p class="text-sm text-yellow-900">{req.admin_message}</p></div>{/if}
					{#each groups as group, index}<details class="document-group" open={index === 0}><summary><span>{group.name}</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><div class="group-files">{#each group.requirements as item}{@render requirementRow(req, item, editable)}{:else}<p class="group-empty">{catalogLoading ? 'Loading document requirements…' : catalogError ? 'See the request requirements below.' : 'No separate requirements for this document. Shared files are listed below.'}</p>{/each}</div></details>{/each}
					{#if req.approved_file_path && ['approved', 'ready_for_pickup', 'released'].includes(requestStatusKey(req.status) ?? '')}<section class="rounded-lg border border-green-200 bg-green-50 p-4"><h3 class="mb-2 text-sm font-semibold text-green-800">{completed ? 'Released document' : 'Ready for Release'}</h3><div class="flex flex-wrap items-center justify-between gap-3"><p class="min-w-0 flex-1 break-words text-sm text-gray-700">{req.approved_file_name ?? 'Document'}</p><Button variant="secondary" size="sm" onclick={() => openFile(req.approved_file_path!, req.approved_file_name ?? 'Document')}>View</Button></div></section>{:else if ['approved', 'ready_for_pickup', 'released'].includes(requestStatusKey(req.status) ?? '')}<p class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">The document is not available yet. Please contact the Graduate School office with your request number.</p>{/if}
				</div>
				</Card>
			</article>
		{/each}
	{/if}
</div>

<Modal open={resubmitOpen} title="Update requirement files" size="md" onclose={() => { if (!resubmitting) resubmitOpen = false; }}>
	{#snippet body()}{#if resubmitReq}<div class="space-y-4"><p class="text-sm text-gray-600">{requirementNeedsCorrection(resubmitReq.status) ? 'Replace every flagged file before submitting. Other files can stay as they are.' : 'Choose the files you want to replace. Existing files stay until the update succeeds.'}</p>{#if resubmitReq.admin_message}<p class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">{resubmitReq.admin_message}</p>{/if}{#if resubmitError}<p role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{resubmitError}</p>{/if}{#each resubmitReq.requirements.filter(item => !item.in_person) as item}<section id={'replace-' + encodeURIComponent(item.name)} class="scroll-mt-4 space-y-3 rounded-xl border p-4 {item.needs_correction ? 'border-yellow-300 bg-yellow-50/30' : 'border-gray-200'}"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-semibold text-gray-800">{item.name}</h3><StatusChip kind="file" value={item.needs_correction ? 'needs_correction' : item.file_path ? 'uploaded' : 'missing'} /></div><p class="break-words text-xs text-gray-500">Current file: {item.file_name ?? 'No file uploaded'}</p>{#if item.signature_note}<p class="text-xs text-gray-600">{item.signature_note}</p>{/if}{#each item.form_files ?? [] as file}<Button variant="secondary" size="sm" title={file.name} loading={downloadBusy === file.public_url} disabled={!!downloadBusy || resubmitting} onclick={() => downloadForm(file)}>Download form</Button>{/each}<RequirementFilePicker name={item.name} file={resubmitFiles[item.name] ?? null} disabled={resubmitting} onchange={(file) => resubmitFiles = { ...resubmitFiles, [item.name]: file }} /></section>{/each}</div>{/if}{/snippet}
	{#snippet footer()}<Button variant="secondary" disabled={resubmitting} onclick={() => resubmitOpen = false}>Cancel</Button><div class="text-right">{#if !canUpdate}<p class="mb-2 text-xs text-gray-600" aria-live="polite">{updateReason}</p>{/if}<Button loading={resubmitting} loadingLabel="Submitting…" disabled={!canUpdate} disabledReason={updateReason} onclick={submitResubmission}>Submit updated files</Button></div>{/snippet}
</Modal>
<FilePreview open={filePreviewOpen} path={filePreviewPath} name={filePreviewName} onclose={() => filePreviewOpen = false} />

<style>
	.document-request, .timeline-anchor { scroll-margin-top: 96px; }
	:global(.document-request-card.needs-correction) { border-color: var(--color-warning); }
	.request-header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-6); padding-bottom: var(--space-6); border-bottom: 1px solid var(--color-border); }
	.request-heading { flex: 1; min-width: 0; }
	h2 { margin: 0; color: var(--color-text); font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); line-height: var(--line-height); }
	.request-meta { margin: var(--space-2) 0; color: var(--color-text-muted); font-size: var(--font-size-helper); overflow-wrap: anywhere; }
	.request-summary { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
	.upload-count { color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.request-body { display: flex; flex-direction: column; gap: var(--space-4); }
	.document-group { border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); }
	summary { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); min-height: var(--control-height); padding: var(--space-3) var(--space-4); border-radius: var(--radius-control); color: var(--color-text); font-size: var(--font-size-body); font-weight: var(--font-weight-medium); cursor: pointer; list-style: none; transition: background-color var(--motion-fast); }
	summary::-webkit-details-marker { display: none; }
	summary:hover { background: var(--color-primary-soft); }
	summary > i { color: var(--color-text-muted); font-size: var(--font-size-helper); transition: transform var(--motion-fast); }
	details[open] > summary > i { transform: rotate(180deg); }
	.group-files { padding: 0 var(--space-4); }
	.requirement-file-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); padding-block: var(--space-3); border-top: 1px solid var(--color-border); }
	.file-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
	.group-empty { padding-bottom: var(--space-4); color: var(--color-text-muted); font-size: var(--font-size-helper); }
	@media (max-width: 639px) {
		.request-header { align-items: stretch; }
		.request-header > :global(.ui-button),
		.request-header > .file-actions { width: 100%; }
		.requirement-file-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
		.requirement-file-row > div:first-child { grid-column: 1 / -1; min-width: 0; }
		.requirement-file-row > .file-actions { grid-column: 1 / -1; width: 100%; }
		.file-actions :global(.ui-button) { flex: 1 1 8rem; min-width: 0; }
	}
	@media (pointer: coarse) { summary { min-height: var(--control-height-touch); } }
</style>
