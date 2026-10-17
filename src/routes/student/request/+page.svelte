<script lang="ts">
	import { pluralize } from '$lib/formatting';
	import { uploadRequirementFiles } from '$lib/upload-requirement-files';
	import { formatFileSize } from '$lib/student-files';
	import { showToast } from '$lib/stores/toasts';
	import StepIndicator from '$lib/components/forms/StepIndicator.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import RequirementFilePicker from '$lib/components/ui/RequirementFilePicker.svelte';
	import FilePreview from '$lib/components/ui/FilePreview.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { requestPurposes } from '$lib/data/purposes';
	import type { PageData } from './$types';
	const { data }: { data: PageData } = $props();
	type Requirement = { form_id?: number | null; needs_signature?: boolean | null; signature_note?: string | null; form_title?: string | null; form_files?: Array<{ public_url: string; name: string; page_no: number }>; name: string; description: string; in_person: boolean };
	type DocOption = { document_id: number; name: string; template_path: string | null; template_name: string | null; requirements: Requirement[] };
	const documents = data.documents as DocOption[];
	const steps = [{ label: 'Select Document', icon: 'fa-solid fa-file', tourTarget: 'request-select-document' }, { label: 'Submit Requirements', icon: 'fa-solid fa-upload', tourTarget: 'request-requirements-step' }, { label: 'Review & Submit', icon: 'fa-solid fa-eye', tourTarget: 'request-review-step' }];
	const maxDocuments = 5;
	let currentStep = $state(1);
	let selectedDocs = $state<DocOption[]>([]);
	let purpose = $state('');
	let files = $state<Record<string, File | null>>({});
	let submitting = $state(false);
	let submitError = $state('');
	let successOpen = $state(false);
	let submitConfirmOpen = $state(false);
	let submittedId = $state('');
	let templatePreviewOpen = $state(false);
	let templatePreviewPath = $state('');
	let templatePreviewName = $state('');
	function hasPdfTemplate(doc: DocOption) { return /\.pdf$/i.test(doc.template_name ?? '') || /\.pdf$/i.test(doc.template_path ?? ''); }
	function viewDocumentTemplate(doc: DocOption) {
		if (!doc.template_path || !hasPdfTemplate(doc)) return;
		templatePreviewPath = doc.template_path;
		templatePreviewName = doc.template_name ?? `${doc.name} template`;
		templatePreviewOpen = true;
	}
	const requirements = $derived.by(() => {
		const merged = new Map<string, Requirement & { neededFor: string[] }>();
		for (const doc of selectedDocs) for (const req of doc.requirements ?? []) {
			const existing = merged.get(req.name);
			if (existing) { existing.neededFor.push(doc.name); existing.in_person ||= req.in_person; }
			else merged.set(req.name, { ...req, neededFor: [doc.name] });
		}
		return [...merged.values()];
	});
	const missingCount = $derived(requirements.filter(req => !req.in_person && !files[req.name]).length);
	const requiredFileCount = $derived(requirements.filter(req => !req.in_person).length);
	const selectedFileCount = $derived(requirements.filter(req => !req.in_person && !!files[req.name]).length);
	const selectionProgress = $derived(requiredFileCount ? Math.round((selectedFileCount / requiredFileCount) * 100) : 0);
	const nextReason = $derived(currentStep === 1 ? 'Select at least one document' : `Upload ${missingCount} more ${pluralize(missingCount, 'file')}`);
	const canProceed = $derived(currentStep === 1 ? selectedDocs.length > 0 : currentStep === 2 ? missingCount === 0 : !!purpose.trim() && missingCount === 0);
	const hasUnsavedProgress = $derived(selectedDocs.length > 0 || Object.values(files).some(Boolean) || !!purpose.trim());
	function guardUnsavedUnload(event: BeforeUnloadEvent) {
		if (!hasUnsavedProgress || submitting || successOpen) return;
		event.preventDefault();
		event.returnValue = '';
	}
	beforeNavigate(({ cancel }) => {
		if (hasUnsavedProgress && !submitting && !successOpen && !window.confirm('Your request details and selected files are not saved yet. Leave this page and discard them?')) cancel();
	});
	function toggleDoc(doc: DocOption, checkbox: HTMLInputElement) {
		const selected = selectedDocs.some(item => item.document_id === doc.document_id);
		if (submitting || (!selected && selectedDocs.length >= maxDocuments)) {
			checkbox.checked = selected;
			return;
		}
		if (selected) selectedDocs = selectedDocs.filter(item => item.document_id !== doc.document_id);
		else selectedDocs = [...selectedDocs, doc];
	}
	function next() { if (canProceed && !submitting && currentStep < 3) currentStep++; }
	function prev() { if (!submitting && currentStep > 1) currentStep--; }
	function requestSubmissionConfirmation() {
		if (submitting || successOpen || submitConfirmOpen || currentStep !== 3 || !canProceed || !selectedDocs.length) return;
		submitConfirmOpen = true;
	}
	async function submitRequest() {
		if (submitting || successOpen || currentStep !== 3 || !canProceed || !selectedDocs.length) return;
		submitConfirmOpen = false;
		submitting = true;
		submitError = '';
		try {
			const reqs = requirements.map(req => ({ name: req.name, description: req.description ?? '', in_person: req.in_person, file_path: null, file_name: null, submitted_at: null, needs_correction: false }));
			const documentIds = selectedDocs.map(doc => doc.document_id);
			const fd = new FormData();
			fd.append('documentIds', JSON.stringify(documentIds));
			fd.append('purpose', purpose.trim());
			fd.append('requirements', JSON.stringify(reqs));
			const uploadFiles = Object.fromEntries(reqs.filter(req => !req.in_person).map(req => [req.name, files[req.name] ?? null]));
			fd.append('uploads', JSON.stringify(await uploadRequirementFiles(uploadFiles, { documentIds })));
			const response = await fetch('/api/requests', { method: 'POST', body: fd });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error ?? 'Submission failed. Please try again.');
			if (!result.request_id) throw new Error('The submission response did not include a request ID. Check My Documents before trying again.');
			submittedId = result.request_id;
			successOpen = true;
			showToast('Request submitted: ' + submittedId);
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'Network error. Please try again.';
			showToast(submitError, 'error');
		} finally { submitting = false; }
	}
	function reset() { currentStep = 1; selectedDocs = []; purpose = ''; files = {}; submitError = ''; successOpen = false; submitConfirmOpen = false; submittedId = ''; }
</script>

<svelte:window onbeforeunload={guardUnsavedUnload} />

<div class="request-workspace w-full min-w-0 space-y-4">
	{#if data.idStatus !== 'verified'}
		<Button href="/student/forms" icon="fa-solid fa-file-lines">Browse forms</Button>
	{:else}
		<Card class="wizard-progress-card"><StepIndicator {steps} {currentStep} disabled={submitting} onstepselect={(step) => { if (!submitting) currentStep = step; }} /></Card>
		<Card class="wizard-step-card">
			{#if currentStep === 1}
				<h2 class="mb-1 text-xl font-semibold text-gray-800">Select Document</h2>
				<p class="document-step-description">Choose up to {maxDocuments} documents. Requirements are shown under each document. If a requirement is shared by selected documents, upload it once.</p>
				{#if documents.length === 0}<div class="py-10 text-center"><p class="mb-4 text-sm text-gray-600">No documents available yet. You can browse forms meanwhile.</p><Button variant="secondary" href="/student/forms">Browse forms</Button></div>{:else}
					<div class="document-list-heading"><span>Available documents</span><span class="document-selection-count" aria-live="polite">{selectedDocs.length} of {maxDocuments} selected</span></div>
					<div class="document-option-grid">
						{#each documents as doc}
							{@const selected = selectedDocs.some(item => item.document_id === doc.document_id)}
							{@const limitReached = !selected && selectedDocs.length >= maxDocuments}
							<div class="ui-document-option {selected ? 'is-selected' : ''} {limitReached ? 'is-limit-reached' : ''}">
								<label title={limitReached ? `Select up to ${maxDocuments} documents` : undefined} class="document-option-label">
									<span class="document-option-heading">
										<input type="checkbox" checked={selected} disabled={limitReached} onchange={(event) => toggleDoc(doc, event.currentTarget)} aria-label={doc.name} />
										<span class="document-option-title">{doc.name}</span>
									</span>
									{#if doc.requirements?.length}
										<span class="document-option-divider" aria-hidden="true"></span>
										<span class="document-option-requirements-title">Requirements</span>
										<ul class="document-option-requirements">{#each doc.requirements as req}<li>{req.name}{req.in_person ? ' (in person)' : ''}</li>{/each}</ul>
									{:else}
										<span class="document-option-divider" aria-hidden="true"></span>
										<span class="document-option-empty">No requirements</span>
									{/if}
								</label>
								{#if doc.template_path && hasPdfTemplate(doc)}<div class="document-template-actions"><Button variant="secondary" size="sm" icon="fa-solid fa-eye" onclick={() => viewDocumentTemplate(doc)}>View PDF</Button></div>{/if}
							</div>
						{/each}
					</div>
				{/if}
			{:else if currentStep === 2}
				<h2 class="mb-1 text-xl font-semibold text-gray-800">Submit Requirements</h2>
				<p class="wizard-step-description">Choose one file for each online requirement. Shared requirements only need one file; items marked in person do not need an upload.</p>
				<div class="wizard-requirements">
					{#each requirements as req}
						<section class="wizard-requirement" aria-label={req.name}>
							<div class="requirement-heading">
								<div class="requirement-copy">
									<h3>{req.name}</h3>
									{#if req.description}<p>{req.description}</p>{/if}
									{#if req.neededFor.length > 1}<p class="requirement-needed-for"><span>Required for:</span> {req.neededFor.join(', ')}</p>{/if}
								</div>
								<StatusChip kind="file" size="sm" value={req.in_person ? 'in_person' : files[req.name] ? 'selected' : 'missing'} />
							</div>
							{#if req.needs_signature}<p class="requirement-signature-note">Get this form signed by: {req.signature_note?.trim() || 'the required signatories'}, then upload a photo or PDF of the signed form.</p>{/if}
							{#if req.in_person}<p class="requirement-in-person-note">Submit this requirement in person at the Graduate School. No file upload is required.</p>{:else}<RequirementFilePicker name={req.name} file={files[req.name] ?? null} showStatus={false} onchange={(file) => files = { ...files, [req.name]: file }} />{/if}
						</section>
					{:else}<p class="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">No requirements needed for these documents. Click Next to continue.</p>{/each}
				</div>
			{:else}
				<h2 class="mb-1 text-xl font-semibold text-gray-800">Review &amp; Submit</h2><p class="mb-6 text-sm text-gray-500">Check your documents and files before submitting.</p>
				<label for="request-purpose" class="mb-2 block text-sm font-medium text-gray-700">Purpose <span aria-hidden="true">(required)</span><span class="sr-only">required</span></label><select id="request-purpose" bind:value={purpose} required disabled={submitting} class="mb-6 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"><option value="" disabled>Select a purpose...</option>{#each requestPurposes as item}<option value={item}>{item}</option>{/each}</select>
				<div class="space-y-4 rounded-xl border border-essu-green/20 bg-essu-green/5 p-4">
					<div class="flex items-center justify-between gap-3"><h3 class="text-sm font-semibold text-gray-800">Documents</h3><Button variant="ghost" size="sm" disabled={submitting} onclick={() => currentStep = 1}>Edit documents</Button></div><ul class="list-disc space-y-1 pl-5 text-sm text-gray-800">{#each selectedDocs as doc}<li>{doc.name}</li>{/each}</ul>
					<div class="flex items-center justify-between gap-3"><h3 class="text-sm font-semibold text-gray-800">Files</h3><Button variant="ghost" size="sm" disabled={submitting} onclick={() => currentStep = 2}>Edit files</Button></div>
					{#each requirements as req}<div class="flex flex-wrap items-center justify-between gap-3 border-t border-essu-green/15 pt-3"><div class="min-w-0 text-sm"><p class="font-medium text-gray-800">{req.name}</p><p class="mt-1 break-words text-xs text-gray-600">{req.in_person ? 'Submit in person' : files[req.name]?.name ?? 'Missing file'}{#if files[req.name] && !req.in_person} · {formatFileSize(files[req.name]!.size)}{/if}</p></div><StatusChip kind="file" value={req.in_person ? 'in_person' : files[req.name] ? 'uploaded' : 'missing'} /></div>{:else}<p class="text-sm text-gray-600">No files required.</p>{/each}
				</div>
				{#if submitError}<p class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{submitError} Your selected files are still here.</p>{/if}
				<div class="mt-6 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800"><i class="fa-solid fa-circle-info mt-0.5 shrink-0" aria-hidden="true"></i><p>After you submit, you can replace requirement files while the request is pending. You cannot change the selected documents.</p></div>
			{/if}
		</Card>
		<div class="wizard-action-bar">
			<div class="wizard-action-summary" aria-live="polite">
				{#if currentStep === 2}
					<div class="wizard-progress-label"><span>{selectedFileCount} of {requiredFileCount} {pluralize(requiredFileCount, 'required file')} selected</span><span>{missingCount} remaining</span></div>
					<div class="wizard-progress-track" role="progressbar" aria-label="Requirement files selected" aria-valuemin="0" aria-valuemax={requiredFileCount} aria-valuenow={selectedFileCount}><span style={`width:${selectionProgress}%`}></span></div>
				{:else if currentStep === 1}
					<p>{selectedDocs.length} of {maxDocuments} selected</p>
					<span>{canProceed ? `Maximum of ${maxDocuments} documents` : nextReason}</span>
				{:else}
					<p>Ready to submit</p>
					{#if !canProceed}<span>{currentStep === 3 && !purpose.trim() ? 'Select a purpose to submit' : nextReason}</span>{/if}
				{/if}
			</div>
			<Button variant="secondary" class="wizard-back-button" onclick={prev} disabled={currentStep === 1 || submitting} icon="fa-solid fa-chevron-left">Back</Button>
			{#if currentStep < 3}<Button class="wizard-next-button" onclick={next} disabled={!canProceed || submitting} icon="fa-solid fa-chevron-right" iconRight>Next</Button>{:else}<Button class="wizard-next-button" onclick={requestSubmissionConfirmation} loading={submitting} loadingLabel="Submitting…" disabled={!canProceed || submitting} disabledReason={!canProceed ? currentStep === 3 && !purpose.trim() ? 'Select a purpose to submit' : nextReason : undefined} icon="fa-solid fa-paper-plane">Submit request</Button>{/if}
		</div>
		{#if submitting}<p class="sr-only" role="status">Submitting…</p>{/if}
	{/if}
</div>
<ConfirmDialog open={submitConfirmOpen} title="Confirm document request" message="Review the documents, purpose and uploaded requirements above. Confirming will submit this request to the Graduate School office." variant="primary" confirmLabel="Confirm submission" cancelLabel="Review again" onclose={() => submitConfirmOpen = false} onconfirm={submitRequest} />
<ConfirmDialog open={successOpen} title="Request submitted" message="Your document request has been submitted. You can track its progress in My Documents." variant="primary" confirmLabel="View my request" cancelLabel="New request" onclose={reset} onconfirm={() => goto('/student/documents#' + encodeURIComponent(submittedId), { invalidateAll: true })}>{#snippet details()}<p class="text-sm text-gray-600">Request ID</p><p class="break-all font-mono text-xl font-semibold text-essu-green">{submittedId}</p>{/snippet}</ConfirmDialog>
<FilePreview open={templatePreviewOpen} path={templatePreviewPath} name={templatePreviewName} bucket="templates" onclose={() => templatePreviewOpen = false} />

<style>
	:global(.wizard-progress-card.ui-card) { padding: var(--space-4) var(--space-5); }
	:global(.wizard-step-card.ui-card) { padding: var(--space-5); }
	.document-step-description { margin: 0 0 var(--space-4); color: var(--color-text-muted); font-size: var(--font-size-body); }
	.document-list-heading { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-2); color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.document-selection-count { flex: 0 0 auto; border-radius: 999px; background: var(--color-primary-soft); padding: 2px var(--space-2); color: var(--color-success); font-weight: var(--font-weight-semibold); }
	.document-option-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
	.document-option-label { display: grid; min-width: 0; gap: var(--space-2); cursor: pointer; }
	.document-option-heading { display: flex; min-width: 0; align-items: flex-start; gap: var(--space-3); }
	.document-option-heading input { width: 20px; height: 20px; flex: 0 0 20px; margin: 1px 0 0; accent-color: var(--color-primary); }
	.document-option-title { min-width: 0; color: var(--color-text); font-size: var(--font-size-body); font-weight: var(--font-weight-semibold); line-height: var(--line-height); overflow-wrap: anywhere; }
	.document-option-divider { display: block; height: 1px; margin-top: var(--space-1); background: color-mix(in srgb, var(--color-primary) 12%, var(--color-border)); }
	.document-option-requirements-title { color: var(--color-text-muted); font-size: 11px; font-weight: var(--font-weight-medium); }
	.document-option-requirements { display: grid; gap: 2px; margin: 0; padding-left: 1.25rem; color: var(--color-text-muted); font-size: var(--font-size-helper); line-height: var(--line-height); }
	.document-option-requirements li { min-width: 0; overflow-wrap: anywhere; }
	.document-option-empty { color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.wizard-step-description { margin: 0 0 var(--space-4); color: var(--color-text-muted); font-size: var(--font-size-body); }
	.wizard-requirements { display: grid; gap: var(--space-3); }
	.wizard-requirement { display: grid; min-width: 0; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); }
	.requirement-heading { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
	.requirement-copy { flex: 1; min-width: 0; }
	.requirement-copy h3 { margin: 0; color: var(--color-text); font-size: var(--font-size-body); font-weight: var(--font-weight-semibold); line-height: var(--line-height); overflow-wrap: anywhere; }
	.requirement-copy p, .requirement-in-person-note { margin: var(--space-1) 0 0; color: var(--color-text-muted); font-size: var(--font-size-helper); line-height: var(--line-height); overflow-wrap: anywhere; }
	.requirement-copy .requirement-needed-for { margin-top: var(--space-2); }
	.requirement-needed-for span { color: var(--color-text); font-weight: var(--font-weight-medium); }
	.requirement-signature-note { margin: 0; padding: var(--space-3); border: 1px solid #bfdbfe; border-radius: var(--radius-control); background: #eff6ff; color: #1e40af; font-size: var(--font-size-helper); line-height: var(--line-height); overflow-wrap: anywhere; }
	.requirement-in-person-note { margin: 0; }
	.wizard-action-bar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; gap: var(--space-2) var(--space-3); padding: var(--space-3) var(--space-5) max(var(--space-3), env(safe-area-inset-bottom, 0px)); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
	.wizard-action-summary { grid-column: 1 / -1; min-width: 0; color: var(--color-text); font-size: var(--font-size-body); line-height: var(--line-height); }
	.wizard-action-summary p { margin: 0; font-weight: var(--font-weight-medium); }
	.wizard-action-summary > span { display: block; margin-top: var(--space-1); color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.wizard-progress-label { display: flex; justify-content: space-between; gap: var(--space-3); color: var(--color-text); font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); }
	.wizard-progress-label span:last-child { flex-shrink: 0; color: var(--color-text-muted); font-weight: var(--font-weight-normal); }
	.wizard-progress-track { height: 4px; margin-top: var(--space-2); overflow: hidden; border-radius: 999px; background: var(--color-primary-soft); }
	.wizard-progress-track span { display: block; height: 100%; border-radius: inherit; background: var(--color-primary); transition: width var(--motion-fast); }
	.wizard-action-bar :global(.ui-button) { width: 100%; height: 44px; min-width: 0; min-height: 44px; justify-content: center; }
	.document-template-actions { display: flex; justify-content: flex-start; margin-top: var(--space-3); }
	.document-template-actions :global(.ui-button) { min-height: 36px; }
	:global(.wizard-step-card h2) { font-size: var(--font-size-card-title); }
	@media (min-width: 768px) {
		.document-option-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (max-width: 480px) {
		:global(.wizard-progress-card.ui-card) { padding: var(--space-3); }
		.wizard-action-bar { padding: var(--space-3) var(--space-3) max(var(--space-3), env(safe-area-inset-bottom, 0px)); }
		.wizard-requirement { gap: var(--space-2); padding: var(--space-3); }
		.wizard-progress-label { font-size: 12px; }
		.document-step-description { margin-bottom: var(--space-3); }
		.document-list-heading { align-items: flex-start; }
		.document-option-grid { gap: var(--space-2); }
		:global(.wizard-step-card.ui-card) { padding: var(--space-3); }
		.document-template-actions :global(.ui-button) { max-width: 100%; }
	}
</style>
