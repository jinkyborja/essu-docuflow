<script lang="ts">
	import StepIndicator from '$lib/components/forms/StepIndicator.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { goto } from '$app/navigation';
	import { requestPurposes } from '$lib/data/purposes';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type DocOption = { document_id: number; name: string; requirements: Requirement[] };
	type Requirement = {
		form_id?: number | null; needs_signature?: boolean | null; signature_note?: string | null;
		form_title?: string | null; form_files?: Array<{ public_url: string; name: string; page_no: number }>;
		name: string; description: string; in_person: boolean;
		file_path: string | null; file_name: string | null;
		submitted_at: string | null; needs_correction: boolean;
	};

	const documents = data.documents as DocOption[];

	const steps = [
		{ label: 'Select Document', icon: 'fa-solid fa-file' },
		{ label: 'Submit Requirements', icon: 'fa-solid fa-upload' },
		{ label: 'Review & Submit', icon: 'fa-solid fa-eye' }
	];

	let currentStep = $state(1);
	let selectedDocs = $state<DocOption[]>([]);
	let purpose = $state('');
	let submitting = $state(false);
	let submitError = $state('');
	let successOpen = $state(false);
	let submittedId = $state('');

	// Files per requirement (keyed by requirement name)
	let files = $state<Record<string, File | null>>({});

	// Requirements now arrive as rows from the server, already ordered.
	const requirements = $derived.by(() => {
		const merged = new Map<string, Requirement & { neededFor: string[] }>();
		for (const doc of selectedDocs) for (const req of doc.requirements ?? []) {
			const existing = merged.get(req.name);
			if (existing) { existing.neededFor.push(doc.name); existing.in_person ||= req.in_person; }
			else merged.set(req.name, { ...req, neededFor: [doc.name] });
		}
		return [...merged.values()];
	});

	const canProceed = $derived.by(() => {
		if (currentStep === 1) return selectedDocs.length > 0;
		if (currentStep === 2) {
			// All non-in-person requirements must have a file
			return requirements.every(r => r.in_person || !!files[r.name]);
		}
		return !!purpose.trim();
	});

	function toggleDoc(doc: DocOption) {
		if (selectedDocs.some((item) => item.document_id === doc.document_id)) {
			selectedDocs = selectedDocs.filter((item) => item.document_id !== doc.document_id);
		} else if (selectedDocs.length < 5) {
			selectedDocs = [...selectedDocs, doc];
		}
	}
	function removeDoc(documentId: number) {
		selectedDocs = selectedDocs.filter((doc) => doc.document_id !== documentId);
	}

	function next() { if (currentStep < 3) currentStep++; }
	function prev() { if (currentStep > 1) currentStep--; }

	async function submitRequest() {
		submitting = true;
		submitError = '';
		try {
			const reqs = requirements.map(r => ({
				name: r.name,
				description: r.description ?? '',
				in_person: r.in_person,
				file_path: null,
				file_name: null,
				submitted_at: null,
				needs_correction: false
			}));

			const fd = new FormData();
			fd.append('documentIds', JSON.stringify(selectedDocs.map((doc) => doc.document_id)));
			fd.append('purpose', purpose.trim());
			fd.append('requirements', JSON.stringify(reqs));

			for (const r of reqs) {
				if (!r.in_person && files[r.name]) {
					fd.append(`file_${r.name}`, files[r.name]!);
				}
			}

			const res = await fetch('/api/requests', { method: 'POST', body: fd });
			const result = await res.json();
			if (!res.ok) { submitError = result.error ?? 'Submission failed.'; return; }
			submittedId = result.request_id;
			successOpen = true;
		} catch {
			submitError = 'Network error. Please try again.';
		} finally {
			submitting = false;
		}
	}

	function reset() {
		currentStep = 1;
		selectedDocs = [];
		purpose = '';
		files = {};
		submitError = '';
		successOpen = false;
		submittedId = '';
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">
	{#if data.idStatus !== 'verified'}
		<div class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">You can request documents once the Graduate School office verifies your student ID.{data.idStatus === 'rejected' && data.idRejectReason ? ` Reason: ${data.idRejectReason}` : ''}</div>
	{:else}
	<!-- Step indicator -->
	<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
		<StepIndicator {steps} {currentStep} />
	</div>

	<!-- Step content -->
	<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">

		<!-- Step 1: Select Document -->
		{#if currentStep === 1}
			<h2 class="text-lg font-semibold text-gray-800 mb-1">Select Document</h2>
			<p class="text-sm text-gray-500 mb-5">Choose the document you want to request.</p>

			{#if documents.length === 0}
				<div class="text-center py-10">
					<i class="fa-solid fa-file-circle-xmark text-4xl text-gray-200 mb-3 block"></i>
					<p class="text-gray-400 text-sm">No documents available. Please check back later.</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{#each documents as doc}
						{@const reqs = doc.requirements ?? []}
						<button
							type="button"
							onclick={() => toggleDoc(doc)}
							aria-pressed={selectedDocs.some((item) => item.document_id === doc.document_id)}
							aria-disabled={!selectedDocs.some((item) => item.document_id === doc.document_id) && selectedDocs.length >= 5}
							class="ui-document-option text-left p-4 border-2 rounded-xl transition-all
								{selectedDocs.some((item) => item.document_id === doc.document_id)
									? 'border-essu-green bg-green-50/60'
									: selectedDocs.length >= 5 ? 'border-gray-200 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}"
						>
							<div class="flex items-center gap-2 mb-2">
								<i class="fa-solid {selectedDocs.some((item) => item.document_id === doc.document_id) ? 'fa-square-check text-essu-green' : 'fa-square text-gray-400'}"></i>
								<p class="font-semibold text-sm text-gray-800">{doc.name}</p>
							</div>
							{#if reqs.length > 0}
								<p class="text-xs text-gray-400">{reqs.length} requirement{reqs.length !== 1 ? 's' : ''}</p>
							{:else}
								<p class="text-xs text-gray-400">No requirements</p>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
			<div class="sticky bottom-0 mt-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm" aria-live="polite">
				<p class="text-sm font-semibold text-gray-700">{selectedDocs.length} {selectedDocs.length === 1 ? 'document' : 'documents'} selected</p>
				<div class="mt-2 flex flex-wrap gap-2">{#each selectedDocs as doc}<span class="inline-flex items-center gap-1 rounded-full bg-essu-green/10 px-3 py-1 text-xs text-essu-green">{doc.name}<button type="button" aria-label={`Remove ${doc.name}`} onclick={() => removeDoc(doc.document_id)} class="rounded-full px-1 hover:bg-essu-green/10"><i class="fa-solid fa-xmark"></i></button></span>{/each}</div>
			</div>

		<!-- Step 2: Submit Requirements -->
		{:else if currentStep === 2}
			<h2 class="text-lg font-semibold text-gray-800 mb-1">Submit Requirements</h2>
			<p class="text-sm text-gray-500 mb-1">Selected documents: <strong>{selectedDocs.map((doc) => doc.name).join(', ')}</strong></p>
			<p class="text-sm text-gray-500 mb-5">Upload the required files below.</p>

			{#if requirements.length === 0}
				<div class="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 flex items-center gap-2">
					<i class="fa-solid fa-circle-info"></i>
					No requirements needed for this document. Click Next to continue.
				</div>
			{:else}
				<div class="space-y-4">
					{#each requirements as req}
						<div class="border border-gray-100 rounded-xl p-4 {req.in_person ? 'bg-orange-50/50 border-orange-200' : ''}">
							<div class="flex items-start justify-between gap-3 mb-2">
								<div>
									<p class="text-sm font-medium text-gray-700">{req.name}</p>
									<p class="mt-0.5 text-xs text-gray-500">Needed for: {req.neededFor.join(', ')}</p>
									{#if req.description}
										<p class="text-xs text-gray-400 mt-0.5">{req.description}</p>
									{/if}
								</div>
								{#if req.in_person}
									<span class="text-xs px-2 py-1 bg-orange-100 border border-orange-200 text-orange-700 rounded-full shrink-0">
										<i class="fa-solid fa-building mr-1"></i>In-person
									</span>
								{/if}
							</div>

							{#if req.form_id}
								<div class="mb-3 space-y-2">
									<p class="text-xs font-medium text-gray-700">{req.form_title}</p>
									<div class="flex flex-wrap gap-2">
										{#each req.form_files ?? [] as file}
											<a href={file.public_url} download={file.name} target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg border border-essu-green/30 text-xs text-essu-green hover:bg-essu-green/5 focus:outline-none focus:ring-2 focus:ring-essu-green/30">{(/\.docx?$/i.test(file.name)) ? 'Download editable Word file' : 'Download form'}{(req.form_files?.length ?? 0) > 1 ? ' - ' + file.name : ''}</a>
										{/each}
									</div>
									{#if !req.in_person}<p class="text-xs text-gray-500">1. Download the form. 2. Get it signed. 3. Upload a clear photo or PDF.</p>{/if}
								</div>
							{/if}
							{#if req.signature_note}<p class="mb-2 text-xs text-gray-600">{req.signature_note}</p>{:else if req.needs_signature}<p class="mb-2 text-xs text-gray-600">Signatures required.</p>{/if}
							{#if req.in_person}
								<div class="p-3 bg-orange-100/60 border border-orange-200 rounded-lg text-xs text-orange-700 flex items-start gap-2">
									<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0"></i>
									<span>This requirement must be submitted in person at the Graduate School. You do not need to upload anything for this.</span>
								</div>
							{:else}
								{#if req.form_id}<p class="mb-1.5 text-sm font-medium text-gray-700">Upload the signed form (photo or PDF)</p>{/if}
								<label class="ui-file-dropzone flex items-start gap-3 px-3 py-2.5 border border-gray-200 border-dashed rounded-lg cursor-pointer hover:border-essu-green/50 hover:bg-essu-green/5 transition-all">
									<i class="fa-solid fa-upload text-gray-400 shrink-0 mt-0.5"></i>
									<span class="text-sm min-w-0 break-words {files[req.name] ? 'text-essu-green font-medium' : 'text-gray-400'}">
										{files[req.name] ? files[req.name]!.name : (req.form_id ? 'Upload the signed form (photo or PDF)' : 'Click to upload (PDF or image)')}
									</span>
									<input aria-label={req.form_id ? 'Upload the signed form (photo or PDF)' : `Upload ${req.name}`} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*" class="hidden" onchange={(e) => {
										const f = (e.target as HTMLInputElement).files?.[0];
										files = { ...files, [req.name]: f ?? null };
									}} />
								</label>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

		<!-- Step 3: Review & Submit -->
		{:else if currentStep === 3}
			<h2 class="text-lg font-semibold text-gray-800 mb-1">Review & Submit</h2>
			<p class="text-sm text-gray-500 mb-5">Confirm your request details before submitting.</p>

			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1.5">Purpose <span class="text-red-500">*</span></label>
					<select
						bind:value={purpose}
						class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30"
					>
						<option value="" disabled>Select a purpose...</option>
						{#each requestPurposes as p}
							<option value={p}>{p}</option>
						{/each}
					</select>
				</div>

				<div class="bg-linear-to-br from-essu-green/5 to-essu-green-mid/5 border border-essu-green/20 rounded-xl p-5 space-y-3 text-sm">
					<div class="flex items-center justify-between"><span class="font-semibold text-gray-700">Documents</span><button type="button" onclick={() => currentStep = 1} class="text-xs text-essu-green hover:underline">Edit</button></div>
					{#each selectedDocs as doc}<p class="text-gray-800">{doc.name}</p>{/each}
					<div class="flex items-center justify-between"><span class="font-semibold text-gray-700">Requirements</span><button type="button" onclick={() => currentStep = 2} class="text-xs text-essu-green hover:underline">Edit</button></div>
					<div class="flex justify-between gap-4">
						<span class="text-gray-500">Document</span>
						<span class="font-medium text-gray-800 text-right">{selectedDocs.map((doc) => doc.name).join(', ')}</span>
					</div>
					<div class="flex justify-between gap-4">
						<span class="text-gray-500">Requirements</span>
						<span class="font-medium text-gray-800 text-right">
							{requirements.filter(r => !r.in_person).length} file{requirements.filter(r => !r.in_person).length !== 1 ? 's' : ''} to upload
							{requirements.filter(r => r.in_person).length > 0 ? ` + ${requirements.filter(r => r.in_person).length} in-person` : ''}
						</span>
					</div>
					{#each requirements as req}
						<div class="flex justify-between gap-4">
							<span class="text-gray-400 text-xs">{req.name}</span>
							<span class="text-xs font-medium {req.in_person ? 'text-orange-600' : 'text-essu-green'} text-right">
								{req.in_person ? 'In-person' : (files[req.name]?.name ?? '—')}
							</span>
						</div>
					{/each}
				</div>

				{#if submitError}
					<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						<i class="fa-solid fa-circle-exclamation mr-1"></i>{submitError}
					</div>
				{/if}

				<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 flex items-start gap-2">
					<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0"></i>
					<span>Once submitted, you cannot edit this request. You will be notified by email about any updates.</span>
				</div>
			</div>
		{/if}

	<!-- Navigation -->
	<div class="flex items-center justify-between">
		<button
			onclick={prev}
			disabled={currentStep === 1}
			class="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
		>
			<i class="fa-solid fa-chevron-left text-xs"></i> Back
		</button>

		{#if currentStep < 3}
			<button
				onclick={next}
				disabled={!canProceed}
				class="flex items-center gap-2 px-5 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Next <i class="fa-solid fa-chevron-right text-xs"></i>
			</button>
		{:else}
			<button
				onclick={submitRequest}
				disabled={submitting || !purpose.trim()}
				class="flex items-center gap-2 px-5 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-40 font-medium"
			>
				{#if submitting}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
				<i class="fa-solid fa-paper-plane text-xs"></i> Submit Request
			</button>
		{/if}
	</div>
	</div>
	{/if}
</div>

<!-- Success Modal -->
<Modal open={successOpen} title="Request Submitted!" size="sm" onclose={reset}>
	{#snippet body()}
		<div class="text-center py-4">
			<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
				<i class="fa-solid fa-circle-check text-green-600 text-3xl"></i>
			</div>
			<p class="text-gray-700 text-sm mb-2">Your document request has been submitted.</p>
			<p class="font-mono font-bold text-essu-green text-lg">{submittedId}</p>
			<p class="text-xs text-gray-400 mt-2">You will be notified by email about updates on your request.</p>
		</div>
	{/snippet}
	{#snippet footer()}
		<button onclick={() => goto('/student/documents', { invalidateAll: true })} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
			View My Requests
		</button>
		<button onclick={reset} class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors">
			New Request
		</button>
	{/snippet}
</Modal>
