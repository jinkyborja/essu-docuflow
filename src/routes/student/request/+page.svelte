<script lang="ts">
	import { pluralize } from '$lib/formatting';
	import { uploadRequirementFiles } from '$lib/upload-requirement-files';
	import { downloadStudentFile, formatFileSize } from '$lib/student-files';
	import { showToast } from '$lib/stores/toasts';
	import StepIndicator from '$lib/components/forms/StepIndicator.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import RequirementFilePicker from '$lib/components/ui/RequirementFilePicker.svelte';
	import StatusChip from '$lib/components/ui/StatusChip.svelte';
	import { goto } from '$app/navigation';
	import { requestPurposes } from '$lib/data/purposes';
	import type { PageData } from './$types';
	const { data }: { data: PageData } = $props();
	type Requirement = { form_id?: number | null; needs_signature?: boolean | null; signature_note?: string | null; form_title?: string | null; form_files?: Array<{ public_url: string; name: string; page_no: number }>; name: string; description: string; in_person: boolean };
	type DocOption = { document_id: number; name: string; template_path: string | null; template_name: string | null; requirements: Requirement[] };
	const documents = data.documents as DocOption[];
	const steps = [{ label: 'Select Document', icon: 'fa-solid fa-file' }, { label: 'Submit Requirements', icon: 'fa-solid fa-upload' }, { label: 'Review & Submit', icon: 'fa-solid fa-eye' }];
	let currentStep = $state(1);
	let selectedDocs = $state<DocOption[]>([]);
	let purpose = $state('');
	let files = $state<Record<string, File | null>>({});
	let submitting = $state(false);
	let submitError = $state('');
	let successOpen = $state(false);
	let submittedId = $state('');
	let downloading = $state<string | null>(null);
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
	const nextReason = $derived(currentStep === 1 ? 'Select at least one document' : `Upload ${missingCount} more ${pluralize(missingCount, 'file')}`);
	const canProceed = $derived(currentStep === 1 ? selectedDocs.length > 0 : currentStep === 2 ? missingCount === 0 : !!purpose.trim() && missingCount === 0);
	function toggleDoc(doc: DocOption) {
		if (submitting) return;
		if (selectedDocs.some(item => item.document_id === doc.document_id)) selectedDocs = selectedDocs.filter(item => item.document_id !== doc.document_id);
		else if (selectedDocs.length < 5) selectedDocs = [...selectedDocs, doc];
	}
	function next() { if (canProceed && !submitting && currentStep < 3) currentStep++; }
	function prev() { if (!submitting && currentStep > 1) currentStep--; }
	async function downloadForm(file: { public_url: string; name: string }) {
		if (downloading) return;
		downloading = file.public_url;
		try { await downloadStudentFile(file.public_url, file.name); showToast('Form downloaded.'); }
		catch (error) { showToast(error instanceof Error ? error.message : 'Could not download the form.', 'error'); }
		finally { downloading = null; }
	}
	async function downloadDocumentTemplate(doc: DocOption) {
		if (!doc.template_path || downloading) return;
		downloading = `template-${doc.document_id}`;
		try {
			const response = await fetch('/api/storage?bucket=templates&path=' + encodeURIComponent(doc.template_path));
			const result = await response.json();
			if (!response.ok || !result.url) throw new Error(result.error ?? 'Could not download this document.');
			await downloadStudentFile(result.url, doc.template_name ?? `${doc.name} template`);
			showToast('Document downloaded.');
		} catch (error) { showToast(error instanceof Error ? error.message : 'Could not download this document.', 'error'); }
		finally { downloading = null; }
	}
	async function submitRequest() {
		if (submitting || successOpen || currentStep !== 3 || !canProceed || !selectedDocs.length) return;
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
	function reset() { currentStep = 1; selectedDocs = []; purpose = ''; files = {}; submitError = ''; successOpen = false; submittedId = ''; }
</script>

<div class="request-workspace w-full min-w-0 space-y-6">
	{#if data.idStatus !== 'verified'}
		<Button href="/student/forms" icon="fa-solid fa-file-lines">Browse forms</Button>
	{:else}
		<Card><StepIndicator {steps} {currentStep} disabled={submitting} onstepselect={(step) => { if (!submitting) currentStep = step; }} /></Card>
		<Card class="wizard-step-card">
			{#if currentStep === 1}
				<h2 class="mb-1 text-xl font-semibold text-gray-800">Select Document</h2>
				<p class="mb-6 text-sm text-gray-500">Choose up to 5 documents. Their requirements are listed below.</p>
				{#if documents.length === 0}<div class="py-10 text-center"><p class="mb-4 text-sm text-gray-600">No documents available yet. You can browse forms meanwhile.</p><Button variant="secondary" href="/student/forms">Browse forms</Button></div>{:else}
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{#each documents as doc}
							{@const selected = selectedDocs.some(item => item.document_id === doc.document_id)}
							{@const limitReached = !selected && selectedDocs.length >= 5}
							<div class="ui-document-option rounded-xl border-2 p-4 transition-colors {selected ? 'border-essu-green bg-essu-green/5' : limitReached ? 'border-gray-200 opacity-50' : 'border-gray-200 hover:border-essu-green/50'}">
								<label title={limitReached ? 'Select up to 5 documents' : undefined} class="flex cursor-pointer items-start gap-3">
									<input type="checkbox" checked={selected} disabled={limitReached} onchange={() => toggleDoc(doc)} aria-label={doc.name} class="mt-0.5 h-5 w-5 shrink-0 accent-essu-green" /><span class="flex-1 text-sm font-semibold text-gray-800">{doc.name}</span>{#if selected}<i class="fa-solid fa-circle-check text-essu-green" aria-hidden="true"></i>{/if}
								</label>
								{#if doc.requirements?.length}<ul class="mt-3 list-disc space-y-1 pl-9 text-xs text-gray-600">{#each doc.requirements as req}<li>{req.name}{req.in_person ? ' (in person)' : ''}</li>{/each}</ul>{:else}<p class="mt-3 pl-8 text-xs text-gray-500">No requirements</p>{/if}
								{#if doc.template_path}<div class="mt-3 flex justify-end"><Button variant="secondary" size="sm" icon="fa-solid fa-download" loading={downloading === `template-${doc.document_id}`} disabled={!!downloading && downloading !== `template-${doc.document_id}`} onclick={() => void downloadDocumentTemplate(doc)}>Download {doc.template_name ?? 'document template'}</Button></div>{/if}
							</div>
						{/each}
					</div>
				{/if}
			{:else if currentStep === 2}
				<h2 class="mb-1 text-xl font-semibold text-gray-800">Submit Requirements</h2>
				<p class="mb-6 text-sm text-gray-500">Upload a file for each requirement. Shared requirements only need one file.</p>
				<div class="space-y-4">
					{#each requirements as req}
						<section class="wizard-requirement" aria-label={req.name}>
							<div class="requirement-heading"><div class="requirement-copy"><h3 class="text-sm font-semibold text-gray-800">{req.name}</h3><p class="mt-1 text-xs text-gray-500">Needed for: {req.neededFor.join(', ')}</p>{#if req.description}<p class="mt-1 text-xs text-gray-600">{req.description}</p>{/if}</div><div class="requirement-downloads">{#each req.form_files ?? [] as file}<Button variant="ghost" icon="fa-solid fa-download" loading={downloading === file.public_url} disabled={!!downloading} title={file.name} onclick={() => downloadForm(file)}>Download form{(req.form_files?.length ?? 0) > 1 ? ' · ' + file.name : ''}</Button>{/each}</div></div>
							{#if req.needs_signature}<p class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">Get this form signed by: {req.signature_note?.trim() || 'the required signatories'}, then upload a photo or PDF of the signed form.</p>{/if}
							{#if req.in_person}<div class="flex flex-wrap items-center justify-between gap-2"><p class="text-xs text-gray-600">Submit this requirement in person at the Graduate School. No file upload is required.</p><StatusChip kind="file" value="in_person" /></div>{:else}<RequirementFilePicker name={req.name} file={files[req.name] ?? null} onchange={(file) => files = { ...files, [req.name]: file }} />{/if}
						</section>
					{:else}<p class="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">No requirements needed for these documents. Click Next to continue.</p>{/each}
				</div>
			{:else}
				<h2 class="mb-1 text-xl font-semibold text-gray-800">Review &amp; Submit</h2><p class="mb-6 text-sm text-gray-500">Check your documents and files before submitting.</p>
				<label for="request-purpose" class="mb-2 block text-sm font-medium text-gray-700">Purpose (required)</label><select id="request-purpose" bind:value={purpose} disabled={submitting} class="mb-6 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"><option value="" disabled>Select a purpose...</option>{#each requestPurposes as item}<option value={item}>{item}</option>{/each}</select>
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
			<Button variant="ghost" onclick={prev} disabled={currentStep === 1 || submitting} icon="fa-solid fa-chevron-left">Back</Button>
			<div class="wizard-action-summary" aria-live="polite"><p>{currentStep === 1 ? `${selectedDocs.length} ${pluralize(selectedDocs.length, 'document')} selected` : currentStep === 2 ? `${requirements.filter(req => !req.in_person && !!files[req.name]).length} files selected` : 'Ready to submit'}</p>{#if !canProceed}<span>{currentStep === 3 && !purpose.trim() ? 'Select a purpose to submit' : nextReason}</span>{/if}</div>
			{#if currentStep < 3}<Button onclick={next} disabled={!canProceed || submitting} disabledReason={nextReason} icon="fa-solid fa-chevron-right" iconRight>Next</Button>{:else}<Button onclick={submitRequest} loading={submitting} loadingLabel="Submitting…" disabled={!canProceed} disabledReason={!purpose.trim() ? 'Select a purpose to submit' : nextReason} icon="fa-solid fa-paper-plane">Submit request</Button>{/if}
		</div>
		{#if submitting}<p class="sr-only" role="status">Submitting…</p>{/if}
	{/if}
</div>
<ConfirmDialog open={successOpen} title="Request submitted" message="Your document request has been submitted. You can track its progress in My Documents." variant="primary" confirmLabel="View my request" cancelLabel="New request" onclose={reset} onconfirm={() => goto('/student/documents#' + encodeURIComponent(submittedId), { invalidateAll: true })}>{#snippet details()}<p class="text-sm text-gray-600">Request ID</p><p class="break-all font-mono text-xl font-semibold text-essu-green">{submittedId}</p>{/snippet}</ConfirmDialog>

<style>
	.wizard-action-bar { position: sticky; bottom: 0; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
	.wizard-action-summary { flex: 1; min-width: 0; color: var(--color-text); font-size: var(--font-size-body); text-align: center; line-height: var(--line-height); }
	.wizard-action-summary p { margin: 0; font-weight: var(--font-weight-medium); }
	.wizard-action-summary span { display: block; margin-top: var(--space-1); color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.wizard-requirement { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-control); }
	.requirement-heading { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--space-4); }
	.requirement-copy { flex: 1; min-width: 0; }
	.requirement-downloads { display: flex; flex-wrap: wrap; gap: var(--space-2); }
	:global(.wizard-step-card h2) { font-size: var(--font-size-card-title); }
	@media (max-width: 639px) {
		.wizard-action-bar { padding: var(--space-4); }
		.wizard-action-summary { order: -1; flex-basis: 100%; }
		.wizard-action-bar :global(.ui-button) { flex: 1 1 7rem; min-width: 0; }
		.requirement-heading { min-width: 0; }
		.requirement-downloads { width: 100%; }
		.requirement-downloads :global(.ui-button) { max-width: 100%; }
	}
</style>
