<script lang="ts">
	import StepIndicator from '$lib/components/forms/StepIndicator.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { goto } from '$app/navigation';
	import { requestPurposes } from '$lib/data/purposes';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type DocOption = { document_id: number; name: string; requirements: Requirement[] };
	type Requirement = {
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
	let selectedDoc = $state<DocOption | null>(null);
	let purpose = $state('');
	let submitting = $state(false);
	let submitError = $state('');
	let successOpen = $state(false);
	let submittedId = $state('');

	// Files per requirement (keyed by requirement name)
	let files = $state<Record<string, File | null>>({});

	// Requirements now arrive as rows from the server, already ordered.
	const requirements = $derived<Requirement[]>(selectedDoc?.requirements ?? []);

	const canProceed = $derived.by(() => {
		if (currentStep === 1) return !!selectedDoc;
		if (currentStep === 2) {
			// All non-in-person requirements must have a file
			return requirements.every(r => r.in_person || !!files[r.name]);
		}
		return !!purpose.trim();
	});

	function selectDoc(doc: DocOption) {
		selectedDoc = doc;
		files = {};
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
			fd.append('document_id', String(selectedDoc!.document_id));
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
		selectedDoc = null;
		purpose = '';
		files = {};
		submitError = '';
		successOpen = false;
		submittedId = '';
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">
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
							onclick={() => selectDoc(doc)}
							class="text-left p-4 border-2 rounded-xl transition-all
								{selectedDoc?.document_id === doc.document_id
									? 'border-essu-green bg-green-50/60'
									: 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}"
						>
							<div class="flex items-center gap-2 mb-2">
								<i class="fa-solid fa-file-lines {selectedDoc?.document_id === doc.document_id ? 'text-essu-green' : 'text-gray-400'}"></i>
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

		<!-- Step 2: Submit Requirements -->
		{:else if currentStep === 2}
			<h2 class="text-lg font-semibold text-gray-800 mb-1">Submit Requirements</h2>
			<p class="text-sm text-gray-500 mb-1">Document: <strong>{selectedDoc?.name}</strong></p>
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

							{#if req.in_person}
								<div class="p-3 bg-orange-100/60 border border-orange-200 rounded-lg text-xs text-orange-700 flex items-start gap-2">
									<i class="fa-solid fa-triangle-exclamation mt-0.5 shrink-0"></i>
									<span>This requirement must be submitted in person at the Graduate School. You do not need to upload anything for this.</span>
								</div>
							{:else}
								<label class="flex items-start gap-3 px-3 py-2.5 border border-gray-200 border-dashed rounded-lg cursor-pointer hover:border-essu-green/50 hover:bg-essu-green/5 transition-all">
									<i class="fa-solid fa-upload text-gray-400 shrink-0 mt-0.5"></i>
									<span class="text-sm min-w-0 break-words {files[req.name] ? 'text-essu-green font-medium' : 'text-gray-400'}">
										{files[req.name] ? files[req.name]!.name : 'Click to upload (PDF or image)'}
									</span>
									<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*" class="hidden" onchange={(e) => {
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
					<div class="flex justify-between gap-4">
						<span class="text-gray-500">Document</span>
						<span class="font-medium text-gray-800 text-right">{selectedDoc?.name}</span>
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
	</div>

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
