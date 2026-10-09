<script lang="ts">
	import type { RequirementSettings } from '$lib/server/requirements';
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type DocRow = {
		document_id: number; name: string; template_path: string | null;
		template_name: string | null; requirements: Array<{ name: string; description?: string; in_person: boolean } & RequirementSettings>;
		upload_date: string; uploaded_by_name: string;
	};

	let documents = $state(data.documents as DocRow[]);

	// Modal mode
	let modalOpen = $state(false);
	let editingId = $state<number | null>(null);
	let saving = $state(false);
	let saveError = $state('');

	// Form state
	let docName = $state('');
	let templateFile = $state<File | null>(null);
	let existingTemplateName = $state<string | null>(null);
	let removeTemplate = $state(false);

	type CustomReq = { name: string; description?: string; in_person: boolean; form_id: number | null; needs_signature: boolean; signature_note: string };
	const forms = $derived(data.forms);
	const emptySettings = () => ({ form_id: null as number | null, needs_signature: false, signature_note: '' });
	let customReqs = $state<CustomReq[]>([]);

	const PRESET_REQS = [
		{ name: 'Clearance Form', description: 'Student clearance form' },
		{ name: 'Valid ID', description: 'Student ID' },
		{ name: 'Honorable Dismissal', description: 'For students transferring to another school' },
		{ name: 'Further Studies Form', description: "For students continuing with Master's or another course" },
		{ name: 'Request Entry Form', description: 'For TOR/certificates when grades are incomplete' },
	];

	type ReqOption = CustomReq & { description: string; checked: boolean };
	let reqOptions = $state<ReqOption[]>(PRESET_REQS.map(r => ({ ...r, ...emptySettings(), checked: false, in_person: false })));

	function openAdd() {
		editingId = null;
		docName = '';
		templateFile = null;
		existingTemplateName = null;
		removeTemplate = false;
		customReqs = [];
		saveError = '';
		reqOptions = PRESET_REQS.map(r => ({ ...r, ...emptySettings(), checked: false, in_person: false }));
		modalOpen = true;
	}

	function openEdit(doc: DocRow) {
		editingId = doc.document_id;
		docName = doc.name;
		templateFile = null;
		existingTemplateName = doc.template_name;
		removeTemplate = false;
		saveError = '';

		const saved: Array<{ name: string; description?: string; in_person: boolean } & RequirementSettings> = doc.requirements ?? [];

		const presetNames = new Set(PRESET_REQS.map(r => r.name));
		reqOptions = PRESET_REQS.map(r => {
			const match = saved.find(s => s.name === r.name);
			return { ...r, checked: !!match, in_person: match?.in_person ?? false, form_id: match?.form_id ?? null, needs_signature: match?.needs_signature ?? false, signature_note: match?.signature_note ?? '' };
		});
		customReqs = saved
			.filter(s => !presetNames.has(s.name))
			.map(s => ({ ...s, form_id: s.form_id ?? null, needs_signature: s.needs_signature ?? false, signature_note: s.signature_note ?? '' }));

		modalOpen = true;
	}

	function buildReqs() {
		const reqs = reqOptions
			.filter(r => r.checked)
			.map(r => ({ name: r.name, description: r.description, in_person: r.in_person, form_id: r.form_id, needs_signature: r.needs_signature, signature_note: r.signature_note }));
		for (const c of customReqs) {
			if (c.name.trim()) reqs.push({ name: c.name.trim(), description: c.description ?? '', in_person: c.in_person, form_id: c.form_id, needs_signature: c.needs_signature, signature_note: c.signature_note });
		}
		return reqs;
	}

	async function handleSave(e: Event) {
		e.preventDefault();
		saveError = '';
		if (!docName.trim()) { saveError = 'Document name is required.'; return; }

		const fd = new FormData();
		fd.append('name', docName.trim());
		fd.append('requirements', JSON.stringify(buildReqs()));
		if (templateFile) fd.append('template', templateFile);
		if (editingId !== null) {
			fd.append('document_id', String(editingId));
			fd.append('remove_template', String(removeTemplate));
		}

		saving = true;
		try {
			const res = await fetch('/api/documents', {
				method: editingId !== null ? 'PATCH' : 'POST',
				body: fd
			});
			const result = await res.json();
			if (!res.ok) { saveError = result.error ?? 'Failed to save.'; return; }
			const listRes = await fetch('/api/documents');
			documents = await listRes.json();
			modalOpen = false;
		} catch {
			saveError = 'Network error.';
		} finally {
			saving = false;
		}
	}

	async function handleDelete(id: number) {
		if (!confirm('Delete this document? This cannot be undone.')) return;
		const res = await fetch('/api/documents', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ document_id: id })
		});
		if (res.ok) documents = documents.filter(d => d.document_id !== id);
	}

	// Requirements arrive as rows from the server; nothing to parse.
	function parseReqs(
		reqs: Array<{ name: string; in_person: boolean }> | null | undefined
	): Array<{ name: string; in_person: boolean }> {
		return reqs ?? [];
	}

	async function openTemplate(path: string) {
		const res = await fetch(`/api/storage?bucket=templates&path=${encodeURIComponent(path)}`);
		const data = await res.json();
		if (data.url) window.open(data.url, '_blank');
	}

	async function downloadTemplate(path: string, name: string) {
		const res = await fetch(`/api/storage?bucket=templates&path=${encodeURIComponent(path)}`);
		const data = await res.json();
		if (!data.url) return;
		const a = document.createElement('a');
		a.href = data.url;
		a.download = name;
		a.click();
	}
</script>

<div class="space-y-5">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold text-gray-800">Document Library</h2>
			<p class="text-sm text-gray-500 mt-0.5">Manage requestable documents and their templates.</p>
		</div>
		<button
			onclick={openAdd}
			class="flex items-center gap-2 px-4 py-2 bg-essu-green text-white rounded-lg text-sm font-medium hover:bg-essu-green-mid transition-colors"
		>
			<i class="fa-solid fa-plus text-xs"></i> Add Document
		</button>
	</div>

	<!-- Document list -->
	{#if documents.length === 0}
		<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
			<i class="fa-solid fa-file-circle-plus text-4xl text-gray-200 mb-4 block"></i>
			<p class="text-gray-500 text-sm">No documents yet. Add one to get started.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
			{#each documents as doc}
				{@const reqs = parseReqs(doc.requirements)}
				<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
					<div class="flex items-start justify-between gap-3">
						<div class="flex items-start gap-3 min-w-0">
							<div class="w-10 h-10 rounded-lg bg-essu-green/10 flex items-center justify-center shrink-0">
								<i class="fa-solid fa-file-lines text-essu-green"></i>
							</div>
							<div class="min-w-0">
								<h3 class="font-semibold text-gray-800 truncate">{doc.name}</h3>
								<p class="text-xs text-gray-400 mt-0.5">
									Added by {doc.uploaded_by_name} ·
									{new Date(doc.upload_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-1 shrink-0">
							<button onclick={() => openEdit(doc)} class="p-1.5 text-gray-300 hover:text-essu-green transition-colors" title="Edit" aria-label={`Edit ${doc.name}`}>
								<i class="fa-solid fa-pen text-sm"></i>
							</button>
							<button onclick={() => handleDelete(doc.document_id)} class="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="Delete" aria-label={`Delete ${doc.name}`}>
								<i class="fa-solid fa-trash text-sm"></i>
							</button>
						</div>
					</div>

					<!-- Template -->
					{#if doc.template_path}
						<div class="mt-3 flex items-center gap-2 text-xs bg-essu-green/5 border border-essu-green/20 rounded-lg px-3 py-2">
							<i class="fa-solid fa-paperclip text-essu-green shrink-0"></i>
							<span class="flex-1 truncate text-essu-green font-medium">{doc.template_name}</span>
							<button
								onclick={() => openTemplate(doc.template_path!)}
								class="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-essu-green/30 text-essu-green hover:bg-essu-green hover:text-white transition-colors"
								title="View"
							>
								<i class="fa-solid fa-eye"></i> View
							</button>
							<button
								onclick={() => downloadTemplate(doc.template_path!, doc.template_name!)}
								class="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-essu-green/30 text-essu-green hover:bg-essu-green hover:text-white transition-colors"
								title="Download"
							>
								<i class="fa-solid fa-download"></i> Download
							</button>
						</div>
					{/if}

					<!-- Requirements -->
					{#if reqs.length > 0}
						<div class="mt-3">
							<p class="text-xs font-medium text-gray-500 mb-2">Requirements</p>
							<div class="flex flex-wrap gap-1.5">
								{#each reqs as req}
									<span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border
										{req.in_person ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-blue-50 border-blue-200 text-blue-700'}">
										<i class="fa-solid {req.in_person ? 'fa-building' : 'fa-upload'} text-xs"></i>
										{req.name}
									</span>
								{/each}
							</div>
						</div>
					{:else}
						<p class="mt-3 text-xs text-gray-400">No requirements set.</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Add / Edit Modal -->
<Modal
	open={modalOpen}
	title={editingId !== null ? 'Edit Document' : 'Add Document'}
	size="md"
	onclose={() => (modalOpen = false)}
>
	{#snippet body()}
		<form id="doc-form" onsubmit={handleSave} class="space-y-5">
			{#if saveError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
					<i class="fa-solid fa-circle-exclamation mr-1"></i>{saveError}
				</div>
			{/if}

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">Document Name <span class="text-red-500">*</span></label>
				<input
					bind:value={docName}
					type="text"
					placeholder="e.g. Transcript of Records"
					required
					class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30"
				/>
			</div>

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1.5">
					Template File <span class="text-gray-400 font-normal text-xs">(optional — PDF or Word)</span>
				</label>

				{#if existingTemplateName && !removeTemplate && !templateFile}
					<div class="flex items-center gap-2 px-3 py-2.5 border border-essu-green/30 bg-essu-green/5 rounded-lg text-sm mb-2">
						<i class="fa-solid fa-paperclip text-essu-green"></i>
						<span class="flex-1 text-essu-green font-medium truncate">{existingTemplateName}</span>
						<button type="button" onclick={() => (removeTemplate = true)} class="text-gray-400 hover:text-red-500 transition-colors text-xs">
							<i class="fa-solid fa-xmark"></i> Remove
						</button>
					</div>
				{/if}

				{#if !existingTemplateName || removeTemplate || templateFile}
					<label class="flex items-start gap-3 px-3 py-2.5 border border-gray-200 border-dashed rounded-lg cursor-pointer hover:border-essu-green/50 hover:bg-essu-green/5 transition-all">
						<i class="fa-solid fa-upload text-gray-400 shrink-0 mt-0.5"></i>
						<span class="text-sm min-w-0 break-words {templateFile ? 'text-essu-green font-medium' : 'text-gray-400'}">
							{templateFile ? templateFile.name : 'Click to upload template'}
						</span>
						<input type="file" accept=".pdf,.doc,.docx" class="hidden" onchange={(e) => {
							const f = (e.target as HTMLInputElement).files?.[0];
							if (f) { templateFile = f; removeTemplate = false; }
						}} />
					</label>
				{/if}
			</div>

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-3">
					Requirements <span class="text-gray-400 font-normal text-xs">(what students must submit)</span>
				</label>
				<div class="space-y-3">
					{#each reqOptions as req, i}
						<div class="border border-gray-100 rounded-lg p-3 {req.checked ? 'bg-essu-green/5 border-essu-green/30' : ''}">
							<label class="flex items-start gap-3 cursor-pointer">
								<input type="checkbox" bind:checked={reqOptions[i].checked} class="mt-0.5 accent-essu-green" />
								<div class="flex-1">
									<p class="text-sm font-medium text-gray-700">{req.name}</p>
									<p class="text-xs text-gray-400">{req.description}</p>
								</div>
							</label>
							{#if req.checked}
								<label class="flex items-center gap-2 mt-2 ml-6 text-xs text-gray-600 cursor-pointer">
									<input type="checkbox" bind:checked={reqOptions[i].in_person} class="accent-orange-500" />
									Requires in-person submission at the office
								</label>
								<div class="mt-3 space-y-2">
									<label class="block text-xs text-gray-600">Linked form
										<select bind:value={reqOptions[i].form_id} class="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30">
											<option value={null}>None</option>
											{#each forms as form}<option value={form.form_id}>{form.title}</option>{/each}
										</select>
									</label>
									<label class="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" bind:checked={reqOptions[i].needs_signature} class="accent-essu-green focus:ring-essu-green/30" />Needs signatures</label>
									<label class="block text-xs text-gray-600">Signature note
										<input bind:value={reqOptions[i].signature_note} maxlength="200" placeholder="Signatures: Librarian, Cashier, Dean" class="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
									</label>
									<p class="text-xs text-gray-400">Form and signature settings apply wherever this requirement is used.</p>

								</div>
							{/if}
						</div>
					{/each}

					<!-- Custom requirements -->
					{#each customReqs as _, i}
						<div class="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
							<div class="flex items-center gap-2 mb-2">
								<input
									bind:value={customReqs[i].name}
									type="text"
									placeholder="e.g. Medical Certificate"
									class="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30"
								/>
								<button
									type="button"
									onclick={() => { customReqs = customReqs.filter((_, j) => j !== i); }}
									class="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
								>
									<i class="fa-solid fa-xmark"></i>
								</button>
							</div>
							<label class="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
								<input type="checkbox" bind:checked={customReqs[i].in_person} class="accent-orange-500" />
								Requires in-person submission at the office
							</label>
							<div class="mt-3 space-y-2">
								<label class="block text-xs text-gray-600">Linked form
									<select bind:value={customReqs[i].form_id} class="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-essu-green/30">
										<option value={null}>None</option>
										{#each forms as form}<option value={form.form_id}>{form.title}</option>{/each}
									</select>
								</label>
								<label class="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" bind:checked={customReqs[i].needs_signature} class="accent-essu-green focus:ring-essu-green/30" />Needs signatures</label>
								<label class="block text-xs text-gray-600">Signature note
									<input bind:value={customReqs[i].signature_note} maxlength="200" placeholder="Signatures: Librarian, Cashier, Dean" class="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
								</label>
								<p class="text-xs text-gray-400">Form and signature settings apply wherever this requirement is used.</p>

							</div>
						</div>
					{/each}
					<button
						type="button"
						onclick={() => { customReqs = [...customReqs, { name: '', in_person: false, ...emptySettings() }]; }}
						class="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-essu-green/50 hover:text-essu-green hover:bg-essu-green/5 transition-all"
					>
						<i class="fa-solid fa-plus text-xs"></i> Add Custom Requirement
					</button>
				</div>
			</div>
		</form>
	{/snippet}
	{#snippet footer()}
		<button onclick={() => (modalOpen = false)} class="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
		<button type="submit" form="doc-form" disabled={saving} class="px-4 py-2 text-sm bg-essu-green text-white rounded-lg hover:bg-essu-green-mid transition-colors disabled:opacity-60 flex items-center gap-2">
			{#if saving}<i class="fa-solid fa-circle-notch fa-spin"></i>{/if}
			{editingId !== null ? 'Save Changes' : 'Save Document'}
		</button>
	{/snippet}
</Modal>
