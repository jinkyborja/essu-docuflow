<script lang="ts">
	import type { RequirementSettings } from '$lib/server/requirements';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { onMount, untrack } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadError from '$lib/components/ui/LoadError.svelte';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import TextField from '$lib/components/forms/TextField.svelte';
	import FileDrop from '$lib/components/forms/FileDrop.svelte';
	import FilePreview from '$lib/components/ui/FilePreview.svelte';
	import { showToast } from '$lib/stores/toasts';
	import { fetchAdminRequests, documentHasRequests, type AdminRequest } from '$lib/admin-requests';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	type DocRow = {
		document_id: number; name: string; template_path: string | null;
		template_name: string | null; requirements: Array<{ name: string; description?: string; in_person: boolean } & RequirementSettings>;
		upload_date: string; uploaded_by_name: string;
	};

	let documents = $state<DocRow[]>(untrack(() => data.documents as DocRow[]));

	let requestUsage = $state<AdminRequest[]>([]), usageLoaded = $state(false), usageError = $state('');
	let deleteTarget = $state<DocRow | null>(null), deleting = $state(false), deleteError = $state('');
	onMount(() => { void loadUsage(); });
	async function loadUsage() { try { requestUsage = await fetchAdminRequests(); usageLoaded = true; usageError = ''; } catch (error) { usageLoaded = false; usageError = (error as Error).message; showToast(usageError, 'error'); } }
	function deleteReason(doc: DocRow) { return !usageLoaded ? usageError ? 'Could not check requests' : 'Checking requests' : documentHasRequests(doc.document_id, requestUsage) ? 'Used by requests' : ''; }
	// Modal mode
	let modalOpen = $state(false);
	let editingId = $state<number | null>(null);
	let saving = $state(false);
	let saveError = $state('');

	// Form state
	let docName = $state('');
	let templateFile = $state<File | null>(null);
	let templateFiles = $state<File[]>([]);
	let existingTemplateName = $state<string | null>(null);
	let removeTemplate = $state(false);
	let templatePreviewOpen = $state(false);
	let templatePreviewPath = $state('');
	let templatePreviewName = $state('');

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
		templateFile = null; templateFiles = [];
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
		templateFile = null; templateFiles = [];
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
			if (!res.ok) { saveError = result.error ?? 'Failed to save.'; showToast(saveError, 'error'); return; }
			modalOpen = false; showToast(editingId !== null ? 'Document updated.' : 'Document added.');
			const listRes = await fetch('/api/documents');
			if (!listRes.ok) throw new Error('Saved, but could not refresh documents. Reload this page.');
			documents = await listRes.json();
			modalOpen = false;
		} catch (error) {
			saveError = (error as Error).message || 'Network error.'; showToast(saveError, 'error');
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!deleteTarget || deleting) return; const target = deleteTarget; deleting = true; deleteError = '';
		try {
			requestUsage = await fetchAdminRequests(); usageLoaded = true;
			if (documentHasRequests(target.document_id, requestUsage)) throw new Error('This document is used by requests and cannot be deleted.');
			const response = await fetch('/api/documents', {method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({document_id: target.document_id})});
			const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Could not delete document.');
			documents = documents.filter(doc => doc.document_id !== target.document_id); deleteTarget = null; showToast('Document deleted.');
		} catch (error) { deleteError = (error as Error).message; showToast(deleteError, 'error'); } finally { deleting = false; }
	}
	// Requirements arrive as rows from the server; nothing to parse.
	function parseReqs(
		reqs: DocRow['requirements'] | null | undefined
	): DocRow['requirements'] {
		return reqs ?? [];
	}

	async function templateUrl(path: string) { const response = await fetch('/api/storage?bucket=templates&path=' + encodeURIComponent(path)); const result = await response.json(); if (!response.ok || !result.url) throw new Error(result.error ?? 'Could not open template.'); return result.url as string; }
	async function openTemplate(path: string, name: string) {
		if (/\.pdf$/i.test(name) || /\.pdf$/i.test(path)) {
			templatePreviewPath = path;
			templatePreviewName = name;
			templatePreviewOpen = true;
			return;
		}
		const preview = window.open('about:blank', '_blank');
		if (!preview) { showToast('Allow pop-ups to view this template.', 'error'); return; }
		preview.opener = null;
		try { preview.location.replace(await templateUrl(path)); showToast('Template opened.'); }
		catch (error) { preview.close(); showToast((error as Error).message, 'error'); }
	}
	async function downloadTemplate(path: string, name: string) { try { const url = await templateUrl(path); const response = await fetch(url); if (!response.ok) throw new Error('Could not download template.'); const objectUrl = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = objectUrl; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); showToast('Template download started.'); } catch (error) { showToast((error as Error).message, 'error'); } }
</script>

<div class="space-y-5">
	<!-- Header -->
	<div class="page-toolbar flex items-center justify-between gap-3">
		<p class="text-sm text-gray-500">Document catalog</p>
		<Button onclick={openAdd} icon="fa-solid fa-plus">Add document</Button>
	</div>

	{#if usageError}<LoadError message="We couldn’t check linked requests. Please try again." onretry={() => void loadUsage()} />{:else if !usageLoaded}<p role="status" class="flex items-center gap-2 text-sm text-gray-600"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>Checking linked requests…</p>{/if}
	<!-- Document list -->
	{#if documents.length === 0}
		<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
			<i class="fa-solid fa-file-circle-plus text-4xl text-gray-200 mb-4 block"></i>
			<p class="text-gray-500 text-sm">No documents yet. Add one to get started.</p><div class="mt-4"><Button onclick={openAdd}>Add document</Button></div>
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
								<h3 class="document-card-title font-semibold text-gray-800 truncate" title={doc.name}>{doc.name}</h3>
								<p class="text-xs text-gray-400 mt-0.5">
									Added by {doc.uploaded_by_name} ·
									{new Date(doc.upload_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
								</p>
							</div>
						</div>
						<RowMenu label={'Actions for ' + doc.name} items={[{label: 'Edit', onselect: () => openEdit(doc)}, {label: 'Delete', danger: true, disabled: !!deleteReason(doc), reason: deleteReason(doc), onselect: () => { deleteTarget = doc; deleteError = ''; }}]} />
					</div>

					<!-- Template -->
					{#if doc.template_path}
						<div class="document-template document-template-mobile mt-3 flex flex-wrap items-center gap-2 text-xs bg-essu-green/5 border border-essu-green/20 rounded-lg px-3 py-2">
							<i class="fa-solid fa-paperclip text-essu-green shrink-0"></i>
							<span class="document-template-name flex-1 truncate text-essu-green font-medium">{doc.template_name}</span>
							<div class="document-template-actions flex flex-wrap items-center gap-2"><Button variant="secondary" size="sm" onclick={() => void openTemplate(doc.template_path!, doc.template_name ?? doc.name)} icon="fa-solid fa-eye">View</Button>
							<Button variant="secondary" size="sm" onclick={() => void downloadTemplate(doc.template_path!, doc.template_name!)} icon="fa-solid fa-download">Download</Button></div>
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
										{#if req.form_id}<i class="fa-solid fa-link text-xs" title="Linked form" aria-label="Linked form"></i>{/if}
										{#if req.needs_signature}<i class="fa-solid fa-signature text-xs" title="Signatures required" aria-label="Signatures required"></i>{/if}
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

<style>
	@media (max-width: 639px) {
		.page-toolbar :global(.ui-button) {
			width: 100%;
		}

		.document-template-name {
			flex-basis: calc(100% - 28px);
		}

		.document-template-actions {
			width: 100%;
		}

		.document-template-actions :global(.ui-button) {
			flex: 1 1 0;
			min-height: 44px;
		}
	}
	@media (max-width: 767px) {
		.document-card-title {
			overflow: visible;
			overflow-wrap: anywhere;
			text-overflow: clip;
			white-space: normal;
		}

		.document-template-mobile {
			align-items: flex-start;
		}

		.document-template-mobile .document-template-name {
			flex: 1 1 calc(100% - 2rem);
			min-width: 0;
			overflow: visible;
			overflow-wrap: anywhere;
			text-overflow: clip;
			white-space: normal;
		}

		.document-template-mobile .document-template-actions {
			display: flex;
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>

<!-- Add / Edit Modal -->
<Modal
	open={modalOpen}
	title={editingId !== null ? 'Edit Document' : 'Add Document'}
	size="md"
	onclose={() => { if (!saving) modalOpen = false; }}
>
	{#snippet body()}
		<form id="doc-form" onsubmit={handleSave} class="space-y-5">
			{#if saveError}
				<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
					<i class="fa-solid fa-circle-exclamation mr-1"></i>{saveError}
				</div>
			{/if}

			<TextField label="Document name" bind:value={docName} placeholder="e.g. Transcript of Records" required error={saveError.includes('name') ? saveError : ''} />

			<div>
				<p class="block text-sm font-medium text-gray-700 mb-1.5">
					Template File <span class="text-gray-400 font-normal text-xs">(optional — PDF or Word)</span>
				</p>

				{#if existingTemplateName && !removeTemplate && !templateFile}
					<div class="flex items-center gap-2 px-3 py-2.5 border border-essu-green/30 bg-essu-green/5 rounded-lg text-sm mb-2">
						<i class="fa-solid fa-paperclip text-essu-green"></i>
						<span class="flex-1 text-essu-green font-medium truncate">{existingTemplateName}</span>
						<button type="button" onclick={() => (removeTemplate = true)} class="text-gray-400 hover:text-red-500 transition-colors text-xs">
							<i class="fa-solid fa-xmark"></i> Remove
						</button>
					</div>
				{/if}

				{#if !existingTemplateName || removeTemplate || templateFile}<FileDrop label="Template file" bind:files={templateFiles} accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" helper="Optional PDF or Word template." onchange={(files) => { templateFile = files[0] ?? null; removeTemplate = false; }} />{/if}
			</div>

			<div>
				<p class="block text-sm font-medium text-gray-700 mb-3">
					Requirements <span class="text-gray-400 font-normal text-xs">(what students must submit)</span>
				</p>
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
									aria-label="Remove custom requirement" title="Remove custom requirement"
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
		<Button variant="secondary" disabled={saving} onclick={() => (modalOpen = false)}>Cancel</Button>
		<Button type="submit" form="doc-form" loading={saving}>{editingId !== null ? 'Save changes' : 'Add document'}</Button>
	{/snippet}
</Modal>
<FilePreview open={templatePreviewOpen} path={templatePreviewPath} name={templatePreviewName} bucket="templates" onclose={() => templatePreviewOpen = false} />

<ConfirmDialog open={!!deleteTarget} title="Delete document" message={'Delete “' + (deleteTarget?.name ?? 'this document') + '”? This cannot be undone.'} confirmLabel="Delete document" loading={deleting} error={deleteError} onclose={() => deleteTarget = null} onconfirm={() => void handleDelete()} />
