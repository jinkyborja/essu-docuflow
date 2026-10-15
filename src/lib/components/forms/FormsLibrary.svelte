<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import type { RowMenuItem } from '$lib/components/ui/RowMenu.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { showToast } from '$lib/stores/toasts';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadError from '$lib/components/ui/LoadError.svelte';
	import { formCategories } from '$lib/data/forms';
	import TextField from './TextField.svelte';
	import TextArea from './TextArea.svelte';
	import FormSection from './FormSection.svelte';
	import PdfDocumentViewer from './PdfDocumentViewer.svelte';
	import { bundledFormPdf, isPdfName } from '$lib/form-pdf';
	type FormFile = { file_id?: number; page_no: number; storage_path: string | null; public_url: string; name: string; type: string; size?: number };
	type FormRecord = { form_id: number; title: string; category: string; code: string | null; description: string; fields: string[]; download_name: string; files: FormFile[] };
	let forms = $state<FormRecord[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let { canManage }: { canManage: boolean } = $props();
	let query = $state(''); let category = $state('All categories');
	let modalOpen = $state(false); let deleteOpen = $state(false); let viewOpen = $state(false); let discardOpen = $state(false);
	let editing = $state<FormRecord | null>(null); let selected = $state<FormRecord | null>(null);
	let deleting = $state<FormRecord | null>(null); let saving = $state(false); let progress = $state(0);
	let pdfBusy = $state<number | null>(null), pdfErrorFor = $state<number | null>(null), pdfError = $state('');
	let pdfPreview = $state<Blob | null>(null), pdfPreviewLoading = $state(false), pdfPreviewError = $state('');
	let previewRequest = 0;
	onDestroy(() => { previewRequest++; });
	let title = $state(''); let categoryValue = $state(''); let newCategory = $state(''); let code = $state(''); let description = $state('');
	let initialTitle = $state(''); let initialDownloadName = $state(''); let editorAttempted = $state(false);
	let dragging = $state(false); let activeUploadName = $state(''); let titleInput = $state<HTMLInputElement>(); let editorTrigger = $state<HTMLElement | null>(null);
	type DraftFile = { file?: File; page_no: number; storage_path: string | null; public_url: string; name: string; type: string; size?: number; preview?: string };
	let draftFiles = $state<DraftFile[]>([]); let inlineError = $state(''); let fileInput = $state<HTMLInputElement>();
	const categories = $derived(['All categories', ...new Set([...formCategories, 'Prospectus', ...forms.map((f) => f.category)])]);
	const previewFiles = $derived(draftFiles.filter((f) => isPreview(f.name)));
	const editableFiles = $derived(draftFiles.filter((f) => !isPreview(f.name)));
	const filtered = $derived(forms.filter((f) => (category === 'All categories' || f.category === category) && `${f.title} ${f.category} ${f.code ?? ''}`.toLowerCase().includes(query.toLowerCase())));
	const resolvedCategory = $derived(categoryValue === '__new' ? newCategory.trim() : categoryValue.trim());
	const editorDirty = $derived(editing ? hasChanges() : !!(title || categoryValue || newCategory || code || description || draftFiles.length));
	const hasPdf = $derived(draftFiles.some(file => isPdfName(file.name) || (!file.storage_path && bundledFormPdf(file.public_url))));
	function editorValidationError() {
		if (!title.trim()) return 'Enter a title.';
		if (!resolvedCategory) return 'Choose or enter a category.';
		if (!description.trim()) return 'Enter a description.';
		if (description.length > 4000) return 'Description must be at most 4,000 characters.';
		if (draftFiles.length < 1) return 'Add at least one file.';
		if (draftFiles.length > 5) return 'A form can have up to 5 files.';
		if (!hasPdf) return 'Include a PDF version for student preview and download.';
		if (editing && !editorDirty) return 'Make a change before saving.';
		return '';
	}
	onMount(() => { void refresh(); });
	async function refresh() {
		loading = true; loadError = '';
		try { const response = await fetch('/api/forms'); const result = await response.json(); if (!response.ok || !Array.isArray(result)) throw new Error(result?.error || 'Could not load forms.'); forms = result; }
		catch (e) { loadError = (e as Error).message; toast(loadError, true); } finally { loading = false; }
	}
	function toast(message: string, error = false) { showToast(message, error ? 'error' : 'success'); }
	function slug(value: string) { return `ESSU-${value.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').toLowerCase() || 'form'}`; }
	function openEditor(form?: FormRecord) {
		editorTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		editing = form ?? null; title = form?.title ?? ''; initialTitle = title; initialDownloadName = form?.download_name ?? ''; categoryValue = form?.category ?? ''; newCategory = ''; code = form?.code ?? ''; description = form?.description ?? ''; editorAttempted = false; inlineError = ''; discardOpen = false;
		draftFiles = form ? form.files.map((f) => ({ ...f })) : [];
		modalOpen = true;
		void tick().then(() => document.getElementById('form-title')?.focus());
	}
	function hasChanges() {
		if (!editing) return false;
		return title !== initialTitle || resolvedCategory !== editing.category || (code.trim() || null) !== (editing.code ?? null) || description !== editing.description || draftFiles.length !== editing.files.length || draftFiles.some((file, index) => {
			const original = editing?.files[index];
			return !original || !!file.file || file.page_no !== original.page_no || file.storage_path !== original.storage_path || file.public_url !== original.public_url;
		});
	}
	function closeEditor() {
		modalOpen = false; discardOpen = false;
		setTimeout(() => editorTrigger?.focus(), 220);
	}
	function requestCloseEditor() {
		if (saving) return;
		if (editorDirty) discardOpen = true;
		else closeEditor();
	}
	function addFiles(list: FileList | null) {
		inlineError = ''; if (!list) return;
		for (const file of Array.from(list)) {
			if (draftFiles.length >= 5) { inlineError = 'A form can have up to 5 files.'; break; }
			const ext = extension(file.name);
			const mime: Record<string, string> = { jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel' };
			if (!mime[ext] || file.size > 10 * 1024 * 1024 || !file.size) { inlineError = `${file.name}: use JPG, PNG, WebP, PDF, DOCX, DOC, XLSX or XLS up to 10 MB.`; continue; }
			if (file.type !== mime[ext]) { inlineError = `${file.name}: file extension and MIME type do not match.`; continue; }
			draftFiles = [...draftFiles, { file, page_no: isPreview(file.name) ? previewFiles.length + 1 : 0, storage_path: null, public_url: '', name: file.name, type: file.type, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }];
		}
	}
	function extension(name: string) { return name.split('.').pop()?.toLowerCase() ?? ''; }
	function isPreview(name: string) { return ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(extension(name)); }
	function moveFile(file: DraftFile, direction: number) { const pages = [...previewFiles]; const i = pages.indexOf(file); const target = i + direction; if (target < 0 || target >= pages.length) return; [pages[i], pages[target]] = [pages[target], pages[i]]; draftFiles = [...pages.map((f, index) => ({ ...f, page_no: index + 1 })), ...editableFiles]; }
	function removeFile(file: DraftFile) { const remaining = draftFiles.filter((item) => item !== file); draftFiles = [...remaining.filter((item) => isPreview(item.name)).map((item, index) => ({ ...item, page_no: index + 1 })), ...remaining.filter((item) => !isPreview(item.name))]; }
	function outputName(form: FormRecord, file: FormFile) { return `ESSU-${form.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'form'}.${extension(file.name)}`; }
	function categoryClass(value: string) { return value === 'Prospectus' ? 'border border-amber-200 bg-amber-100 text-amber-900' : ''; }
	async function save() {
		editorAttempted = true;
		const realCategory = resolvedCategory;
		const validationError = editorValidationError();
		if (validationError) { inlineError = validationError; return; }
		saving = true; progress = 0; inlineError = '';
		try {
			const nextFiles = draftFiles.map((f) => ({ page_no: isPreview(f.name) ? f.page_no : 0, storage_path: f.storage_path, public_url: f.public_url, name: f.name, type: f.type, size: f.file?.size ?? f.size }));
			const newOnes = draftFiles.filter((f) => f.file);
			if (newOnes.length) {
				const urlResponse = await fetch('/api/forms/upload-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files: newOnes.map((f) => ({ name: f.file!.name, type: f.file!.type, size: f.file!.size })) }) });
				const result = await urlResponse.json(); if (!urlResponse.ok) throw new Error(result.error || 'Could not prepare file upload.');
				for (let i = 0; i < newOnes.length; i++) {
					activeUploadName = newOnes[i].name;
					const target = nextFiles[draftFiles.indexOf(newOnes[i])];
					const upload = result.uploads[i]; const response = await fetch(upload.signedUrl, { method: 'PUT', headers: { 'content-type': upload.type }, body: newOnes[i].file });
					if (!response.ok) throw new Error(`Upload failed for ${upload.name}.`);
					if (target) { target.storage_path = upload.path; target.public_url = upload.publicUrl; }
					progress = Math.round(((i + 1) / newOnes.length) * 100);
				}
			}
			const body = { title, category: realCategory, code: code.trim() || null, description, fields: editing ? editing.fields : [], download_name: editing && title === initialTitle ? initialDownloadName : slug(title), files: nextFiles.map((f) => ({ ...f })) };
			const response = await fetch(editing ? `/api/forms/${editing.form_id}` : '/api/forms', { method: editing ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
			const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save form.');
			closeEditor(); toast(editing ? 'Form updated.' : 'Form added.'); await refresh();
		} catch (e) { inlineError = (e as Error).message; toast(inlineError, true); } finally { saving = false; activeUploadName = ''; }
	}
	async function deleteForm() { if (!deleting) return; saving = true; try { const response = await fetch(`/api/forms/${deleting.form_id}`, { method: 'DELETE' }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not delete form.'); deleteOpen = false; toast('Form deleted.'); await refresh(); } catch (e) { toast((e as Error).message, true); } finally { saving = false; } }
	async function download(url: string, name: string) { try { const response = await fetch(url); if (!response.ok) throw new Error('Could not download ' + name + '.'); const objectUrl = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = objectUrl; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); toast('Download started: ' + name); } catch (error) { toast((error as Error).message, true); } }
	function previewPages(form: FormRecord) { return form.files.filter((file) => isPreview(file.name)); }
	function previewPdfSources(form: FormRecord) {
		const sources = form.files.flatMap((file) => {
			if (isPdfName(file.name)) return [{ file, url: file.public_url }];
			const bundledPdf = !file.storage_path ? bundledFormPdf(file.public_url) : null;
			return bundledPdf ? [{ file, url: bundledPdf }] : [];
		});
		return [...new Map(sources.map((source) => [source.url, source])).values()];
	}
	function previewImageFiles(form: FormRecord) { return previewPages(form).filter((file) => file.type.startsWith('image/')); }
	function editableFilesFor(form: FormRecord) { return form.files.filter((file) => !isPreview(file.name)); }
	function hasPdfDownload(form: FormRecord) { return form.files.some((file) => isPdfName(file.name) || (!file.storage_path && bundledFormPdf(file.public_url))); }
	function availableFormats(form: FormRecord) {
		return [...new Set([
			...(hasPdfDownload(form) ? ['PDF'] : []),
			...(previewPdfSources(form).length ? ['Preview PDF'] : []),
			...(canManage ? editableFilesFor(form).map((file) => extension(file.name).toUpperCase()) : []),
			...(canManage && previewImageFiles(form).length ? ['Preview images'] : [])
		])];
	}
	function downloadEditable(form: FormRecord, file: FormFile) { download(file.public_url, outputName(form, file)); }
	function downloadPreviewPdfs(form: FormRecord) {
		for (const source of previewPdfSources(form)) void download(source.url, outputName(form, { ...source.file, name: 'form.pdf' }));
	}
	function downloadPreviewImages(form: FormRecord) { for (const file of previewImageFiles(form)) void download(file.public_url, outputName(form, file)); }
	function downloadItems(form: FormRecord): RowMenuItem[] {
		const items: RowMenuItem[] = [];
		if (hasPdfDownload(form)) items.push({ label: 'Download PDF', icon: 'fa-solid fa-file-pdf', onselect: () => void downloadPdf(form) });
		const editable = canManage ? editableFilesFor(form) : [];
		for (const file of editable) {
			const format = extension(file.name).toUpperCase();
			const sameFormat = editable.filter((item) => extension(item.name) === extension(file.name)).length > 1;
			items.push({
				label: `Download ${format}${sameFormat ? ` · ${file.name}` : ''}`,
				icon: format === 'DOCX' || format === 'DOC' ? 'fa-solid fa-file-word' : 'fa-solid fa-file-excel',
				onselect: () => downloadEditable(form, file)
			});
		}
		if (previewPdfSources(form).length) items.push({ label: 'Download Preview PDF', icon: 'fa-solid fa-file-pdf', onselect: () => downloadPreviewPdfs(form) });
		if (canManage && previewImageFiles(form).length) items.push({ label: 'Download Preview Images', icon: 'fa-solid fa-file-image', onselect: () => downloadPreviewImages(form) });
		return items;
	}
	function cancelDiscard() { discardOpen = false; void tick().then(() => document.getElementById('form-title')?.focus()); }
	async function formPdf(form: FormRecord, preview = false): Promise<Blob> {
		let response: Response;
		try {
			response = await fetch('/api/forms/' + form.form_id + '/download' + (preview ? '?preview=1' : ''));
		} catch {
			throw new Error(preview ? 'Unable to load PDF preview. Please try again.' : 'Could not load the PDF. Please try again.');
		}
		if (!response.ok) {
			if (preview) throw new Error(response.status === 404 || response.status === 409 ? 'PDF preview is unavailable.' : 'Unable to load PDF preview. Please try again.');
			const result = await response.json().catch(() => ({}));
			throw new Error(result.error ?? 'Could not load the PDF. Please try again.');
		}
		let bytes: ArrayBuffer;
		try {
			bytes = await response.arrayBuffer();
		} catch {
			throw new Error(preview ? 'Unable to load PDF preview. Please try again.' : 'Could not load the PDF. Please try again.');
		}
		if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error(preview ? 'Unable to load PDF preview. Please try again.' : 'The file is not a valid PDF. Please contact the Graduate School office.');
		return new Blob([bytes], {type:'application/pdf'});
	}
	async function downloadPdf(form: FormRecord) {
		if (pdfBusy !== null) return;
		pdfBusy = form.form_id; pdfError = ''; pdfErrorFor = null;
		try {
			const objectUrl = URL.createObjectURL(await formPdf(form));
			const link = document.createElement('a'); link.href = objectUrl; link.download = outputName(form, {name:'form.pdf'} as FormFile); link.click();
			setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); toast('PDF download started.');
		} catch (problem) { pdfError = problem instanceof Error ? problem.message : 'Could not download the PDF.'; pdfErrorFor = form.form_id; toast(pdfError, true); }
		finally { pdfBusy = null; }
	}
	async function viewForm(form: FormRecord) {
		const request = ++previewRequest;
		pdfPreview = null; pdfPreviewError = '';
		selected = form; viewOpen = true;
		pdfPreviewLoading = true;
		try {
			const file = await formPdf(form, true);
			if (request === previewRequest && viewOpen && selected?.form_id === form.form_id) pdfPreview = file;
		} catch (problem) {
			if (request === previewRequest && viewOpen) pdfPreviewError = problem instanceof Error && problem.message === 'PDF preview is unavailable.'
				? problem.message
				: 'Unable to load PDF preview. Please try again.';
		} finally {
			if (request === previewRequest) pdfPreviewLoading = false;
		}
	}
	function closePreview() {
		previewRequest++;
		viewOpen = false; pdfPreviewLoading = false; pdfPreviewError = '';
		pdfPreview = null;
	}

</script>



<svelte:head><title>Forms | Portal</title></svelte:head>
<div class="space-y-5">
	{#snippet downloadTrigger()}<span class="library-download-label"><i class="fa-solid fa-download" aria-hidden="true"></i>Download<i class="fa-solid fa-chevron-down library-download-chevron" aria-hidden="true"></i></span>{/snippet}
	{#if canManage}<header class="page-toolbar flex flex-wrap items-center justify-between gap-4"><p class="text-sm text-gray-500">Official forms library</p><Button onclick={() => openEditor()} icon="fa-solid fa-plus">Add form</Button></header>{/if}
	<div class="library-filters"><label class="library-search"><span class="sr-only">Search forms</span><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input bind:value={query} placeholder="Search forms" /></label><label class="library-category-filter"><span class="sr-only">Filter by category</span><select bind:value={category}>{#each categories as item}<option>{item}</option>{/each}</select></label></div>
	{#if loading}<div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-live="polite">{#each [1, 2, 3, 4] as _}<Card><Skeleton variant="text" lines={3} label="Loading form" /></Card>{/each}</div>
	{:else if loadError}<LoadError message="We couldn’t load the forms. Please try again." onretry={refresh} />
	{:else if forms.length === 0 && canManage}<EmptyState message="No forms yet" description="Add a form to make it available to staff." icon="fa-solid fa-file-circle-plus" /><div class="-mt-12 pb-8 flex justify-center"><Button onclick={() => openEditor()} icon="fa-solid fa-plus">Add form</Button></div>
	{:else if filtered.length === 0}<EmptyState message={forms.length ? 'No forms found' : 'No forms available yet'} description={forms.length ? 'Try another search or category.' : 'Check back later or contact the Graduate School office.'} /><div class="flex justify-center pb-6">{#if forms.length}<Button variant="secondary" onclick={() => { query = ''; category = 'All categories'; }}>Clear filters</Button>{:else}<Button variant="secondary" onclick={refresh}>Try again</Button>{/if}</div>
	{:else}<div class="library-grid grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">{#each filtered as form (form.form_id)}
		<Card class="form-library-card" hover>
			<div class="library-card-heading"><span class="library-category">{form.category}</span>{#if form.code}<span class="library-code">{form.code}</span>{/if}</div>
			<h3 class="library-title">{form.title}</h3><p class="library-description">{form.description}</p>{#if pdfErrorFor === form.form_id}<p role="alert" class="mt-2 text-sm text-red-700">{pdfError}</p>{/if}
			<p class="library-meta">{hasPdfDownload(form) ? 'PDF preview available' : 'PDF preview unavailable'}</p>
			{#snippet footer()}
				<div class="library-card-footer">
					<div class="library-primary-actions">
						<Button variant="secondary" onclick={() => void viewForm(form)} icon="fa-solid fa-eye" class="library-view-button">View</Button>
						<RowMenu label={'Download options for ' + form.title} items={downloadItems(form)} triggerContent={downloadTrigger} triggerClass="library-download-trigger" loading={pdfBusy === form.form_id} disabled={downloadItems(form).length === 0} />
					</div>
					<div class="library-secondary-actions">
						<div class="library-format-list" aria-label="Available file formats">{#each availableFormats(form) as format}<span class="library-file-type">{format}</span>{/each}</div>
						{#if canManage}<RowMenu label={'Administrative actions for ' + form.title} items={[{label: 'Edit', onselect: () => openEditor(form)}, {label: 'Delete', danger: true, onselect: () => { deleting = form; deleteOpen = true; }}]} />{/if}
					</div>
				</div>
			{/snippet}
		</Card>
	{/each}</div>{/if}
</div>

{#if canManage}<Modal open={modalOpen} title={editing ? 'Edit form' : 'Add form'} size="lg" onclose={requestCloseEditor}>
	{#snippet body()}
		<form id="form-editor" class="form-editor-body space-y-6 {editing ? 'editor-editing' : ''}" onsubmit={(e) => { e.preventDefault(); void save(); }}>
			<FormSection title="Details">
				<div class="space-y-4">
					<TextField id="form-title" label="Title" bind:value={title} required maxlength={200} error={editorAttempted && !title.trim() ? 'Enter a title.' : ''} />
					<div class="grid gap-4 sm:grid-cols-2">
						<div><label for="form-category" class="form-label">Category <span class="text-red-600">*</span></label><div class="relative"><select id="form-category" bind:value={categoryValue} onblur={() => editorAttempted = true} required class="form-control appearance-none pr-10" aria-invalid={editorAttempted && !resolvedCategory}><option value="">Choose category</option>{#each categories.filter((c) => c !== 'All categories') as item}<option value={item}>{item}</option>{/each}<option value="__new">New category...</option></select><i class="fa-solid fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500" aria-hidden="true"></i></div>{#if editorAttempted && !resolvedCategory}<p class="form-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Choose or enter a category.</p>{/if}</div>
						<div><label for="form-code" class="form-label">Form code / version</label><input id="form-code" bind:value={code} placeholder="e.g. ESSU-ACAD-213 v5" class="form-control" /></div>
						{#if categoryValue === '__new'}<div class="sm:col-span-2"><label for="new-category" class="form-label">New category <span class="text-red-600">*</span></label><input id="new-category" bind:value={newCategory} onblur={() => editorAttempted = true} maxlength="100" class="form-control" aria-invalid={editorAttempted && !newCategory.trim()} />{#if editorAttempted && !newCategory.trim()}<p class="form-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Enter the new category name.</p>{/if}</div>{/if}
					</div>
					<TextArea id="form-description" label="Description" bind:value={description} required maxlength={4000} rows={5} helper="Shown on the form card. Say what the form is for and who signs it." error={editorAttempted && !description.trim() ? 'Enter a description.' : ''} />
				</div>
			</FormSection>
			<section class="space-y-4 border-t border-gray-200 pt-5" aria-labelledby="files-heading">
				<div class="flex items-center justify-between gap-3"><h3 id="files-heading" class="form-section-label">Files</h3><span class="text-xs font-medium text-gray-500">{draftFiles.length} of 5 files</span></div>
				<button type="button" class="form-dropzone {dragging ? 'form-dropzone-active' : ''}" aria-label="Add form files. Drag files here or browse." disabled={saving} onclick={() => fileInput?.click()} ondragenter={(e) => { e.preventDefault(); dragging = true; }} ondragover={(e) => { e.preventDefault(); dragging = true; }} ondragleave={(e) => { if (e.currentTarget === e.target) dragging = false; }} ondrop={(e) => { e.preventDefault(); dragging = false; addFiles(e.dataTransfer?.files ?? null); }}>
					<i class="fa-solid fa-cloud-arrow-up text-2xl text-essu-green" aria-hidden="true"></i><span class="text-sm font-semibold text-gray-800">Drag files here or <span class="text-essu-green underline">Browse</span></span><span class="text-xs text-gray-500">Include a PDF for student downloads. Images, Word or Excel can be added as supporting copies. Up to 5 files, 10 MB each.</span>
				</button>
				<input bind:this={fileInput} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.doc,.xlsx,.xls" multiple class="sr-only" aria-label="Browse form files" disabled={saving} onchange={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ''; }} />
				{#if editorAttempted && draftFiles.length === 0}<p class="form-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Add at least one file.</p>{/if}
				{#if inlineError}<p class="form-error" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{inlineError}</p>{/if}
				<div class="space-y-2">
					{#each previewFiles as file, i (file.page_no + '-' + file.name)}
						<div class="form-file-row">
							<div class="form-file-thumb">{#if file.type === 'application/pdf' || file.public_url.toLowerCase().endsWith('.pdf')}<i class="fa-solid fa-file-pdf text-xl text-gray-500" aria-label="PDF"></i>{:else if file.preview}<img src={file.preview} alt="" class="h-full w-full object-cover object-top" onerror={(e) => { (e.currentTarget as HTMLImageElement).classList.add('hidden'); e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} /><i class="hidden fa-solid fa-file-image text-xl text-gray-400" aria-hidden="true"></i>{:else}<img src={file.public_url} alt="" class="h-full w-full object-cover object-top" onerror={(e) => { (e.currentTarget as HTMLImageElement).classList.add('hidden'); e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} /><i class="hidden fa-solid fa-file-image text-xl text-gray-400" aria-hidden="true"></i>{/if}</div>
							<div class="min-w-0 flex-1"><div class="mb-1 flex items-center gap-2"><span class="form-page-badge">Page {i + 1}</span><span class="truncate text-sm font-medium text-gray-800">{file.name}</span></div><div class="flex items-center gap-2 text-xs text-gray-500">{#if file.file}<span>{(file.file.size / 1024).toFixed(0)} KB</span><span class="form-file-status form-file-new">New</span>{:else}<span class="form-file-status">Existing</span>{/if}</div>{#if saving && activeUploadName === file.name}<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200"><div class="h-full bg-essu-green transition-all" style={`width:${progress}%`}></div></div>{/if}</div>
							<button type="button" aria-label={`Move ${file.name} up`} title={`Move ${file.name} up`} class="form-file-action" onclick={() => moveFile(file, -1)} disabled={saving || i === 0}><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button><button type="button" aria-label={`Move ${file.name} down`} title={`Move ${file.name} down`} class="form-file-action" onclick={() => moveFile(file, 1)} disabled={saving || i === previewFiles.length - 1}><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button><button type="button" aria-label={`Remove ${file.name}`} title={`Remove ${file.name}`} class="form-file-action form-file-remove" onclick={() => removeFile(file)} disabled={saving}><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
						</div>
					{/each}
					{#each editableFiles as file}
						<div class="form-file-row"><div class="form-file-thumb"><i class="fa-solid {['doc','docx'].includes(extension(file.name)) ? 'fa-file-word text-blue-700' : 'fa-file-excel text-green-700'} text-2xl" aria-hidden="true"></i></div><div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-gray-800">{file.name}</p><div class="flex items-center gap-2 text-xs text-gray-500">{#if file.file || file.size}<span>{((file.file?.size ?? file.size ?? 0) / 1024).toFixed(0)} KB</span>{/if}{#if file.file}<span class="form-file-status form-file-new">New</span>{:else}<span class="form-file-status">Existing</span>{/if}</div></div><button type="button" aria-label={`Remove ${file.name}`} title={`Remove ${file.name}`} class="form-file-action form-file-remove" onclick={() => removeFile(file)} disabled={saving}><i class="fa-solid fa-trash" aria-hidden="true"></i></button></div>
					{/each}
				</div>
			</section>
		</form>
	{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={requestCloseEditor} disabled={saving} class="rounded-[10px]">Cancel</Button><Button onclick={() => void save()} disabled={saving} loading={saving} class="rounded-[10px]">{editing ? 'Save changes' : 'Add form'}</Button>{/snippet}
</Modal>
<ConfirmDialog open={discardOpen} title="Discard changes?" message="Your unsaved changes will be lost." confirmLabel="Discard changes" cancelLabel="Keep editing" onclose={cancelDiscard} onconfirm={closeEditor} />
<ConfirmDialog open={deleteOpen} title="Delete form" message={'Delete “' + (deleting?.title ?? 'this form') + '”? Its files will be removed. This cannot be undone.'} confirmLabel="Delete form" loading={saving} onclose={() => deleteOpen = false} onconfirm={() => void deleteForm()} />
{/if}
<Modal open={viewOpen} title={selected?.title ?? 'View form'} size="xl" onclose={closePreview}>
	{#snippet body()}<div class="library-preview-content">{#if selected?.description}<p class="text-gray-700">{selected.description}</p>{/if}<p class="text-sm text-gray-500">PDF preview. Other file formats remain available from Download.</p>{#if pdfPreviewLoading}<p class="library-preview-state" role="status">Loading PDF preview...</p>{:else if pdfPreviewError}<div class="library-preview-unavailable" role="alert"><p>{pdfPreviewError}</p><Button variant="secondary" onclick={() => selected && void viewForm(selected)}>Retry</Button></div>{:else if pdfPreview}<PdfDocumentViewer file={pdfPreview} />{:else}<div class="library-preview-unavailable">PDF preview is unavailable.</div>{/if}</div>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={closePreview}>Close</Button>{/snippet}
</Modal>


<style>
	:global(.form-library-card.ui-card) { display: flex; min-height: 0; flex-direction: column; padding: var(--space-5); border-radius: var(--radius-card); }
	:global(.form-library-card > .card-footer) { display: block; margin-top: auto; padding-top: var(--space-4); }
	.library-filters { display: grid; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); }
	.library-search, .library-category-filter { position: relative; display: flex; min-width: 0; align-items: center; }
	.library-search i { position: absolute; left: var(--space-3); color: var(--color-text-muted); }
	.library-search input, .library-category-filter select { width: 100%; height: 48px; min-width: 0; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); padding: 0 var(--space-3); color: var(--color-text); font-size: var(--font-size-input); outline: none; }
	.library-search input { padding-left: 40px; }
	.library-search input:focus, .library-category-filter select:focus { border-color: var(--color-primary); box-shadow: var(--focus-ring); }
	.library-grid { align-items: stretch; }
	.library-grid > :global(.form-library-card) { min-width: 0; }
	.library-card-heading { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); }
	.library-category, .library-file-type { display: inline-flex; max-width: 100%; align-items: center; overflow-wrap: anywhere; padding: var(--space-1) var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-primary-soft); color: var(--color-primary); font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); line-height: var(--line-height); }
	.library-code, .library-meta { color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.library-title { min-width: 0; margin: 0; color: var(--color-text); font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); line-height: var(--line-height); overflow-wrap: anywhere; }
	.library-description { display: -webkit-box; min-width: 0; overflow: hidden; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; margin: var(--space-3) 0; color: var(--color-text-muted); font-size: var(--font-size-body); line-height: var(--line-height); }
	.library-meta { margin: 0 0 var(--space-4); }
	.library-card-footer { display: grid; gap: var(--space-3); width: 100%; }
	.library-primary-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); width: 100%; }
	.library-primary-actions :global(.button-tooltip), .library-primary-actions :global(.row-menu) { display: flex; min-width: 0; width: 100%; }
	.library-primary-actions :global(.ui-button), .library-primary-actions :global(.row-menu-trigger) { width: 100%; height: 46px; min-width: 0; min-height: 46px; padding-inline: var(--space-2); border-radius: var(--radius-control); font-size: var(--font-size-body); white-space: nowrap; }
	.library-primary-actions :global(.library-download-trigger) { border-color: var(--color-primary); background: var(--color-primary); color: var(--color-surface); }
	.library-primary-actions :global(.library-download-trigger:hover:not(:disabled)) { border-color: var(--color-primary-hover); background: var(--color-primary-hover); }
	.library-download-label { display: flex; min-width: 0; align-items: center; justify-content: center; gap: var(--space-2); }
	.library-download-chevron { margin-left: auto; font-size: 0.7em; }
	.library-secondary-actions { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: var(--space-2); }
	.library-format-list { display: flex; min-width: 0; flex-wrap: wrap; gap: var(--space-1); }
	.library-file-type { padding-block: 0; background: var(--color-bg); color: var(--color-text-muted); }
	.library-preview-content { display: grid; min-width: 0; gap: var(--space-3); }
	.library-preview-content > p { flex: 0 0 auto; }
	.library-preview-content :global(.pdf-viewer) { flex: 1 1 auto; width: 100%; height: clamp(320px, 62dvh, 760px); border: 1px solid var(--color-border); border-radius: var(--radius-control); }
	.library-preview-state { margin: auto; color: var(--color-text-muted); text-align: center; }
	.library-preview-unavailable { display: grid; justify-items: center; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-bg); padding: var(--space-4); color: var(--color-text-muted); font-size: var(--font-size-body); text-align: center; }
	.library-preview-unavailable p { margin: 0; }
	:global(.ui-modal-panel:has(.library-preview-content)) { min-height: 0; overflow: hidden; }
	:global(.ui-modal-panel:has(.library-preview-content) > .modal-body) { display: flex; min-height: 0; overflow: hidden; }
	:global(.ui-modal-panel:has(.library-preview-content) > .modal-body > .library-preview-content) { display: flex; min-height: 0; flex: 1 1 auto; flex-direction: column; }
	.form-label { display: block; margin-bottom: 6px; color: var(--color-text); font-size: var(--font-size-body); font-weight: 600; }
	.form-control { display: block; width: 100%; height: 44px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); padding: 0 var(--space-3); color: var(--color-text); font-size: var(--font-size-input); line-height: var(--line-height); outline: none; transition: border-color var(--motion-fast), box-shadow var(--motion-fast); }
	.form-control:hover { border-color: var(--line-strong); }
	.form-control:focus { border-color: var(--color-primary); box-shadow: var(--focus-ring); }
	.form-control[aria-invalid="true"] { border-color: var(--color-danger); }
	.form-error { display: flex; align-items: flex-start; gap: 6px; margin-top: 6px; color: var(--color-danger); font-size: 12px; }
	.form-section-label { color: var(--color-text-muted); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); letter-spacing: 0.1em; text-transform: uppercase; }
	.form-dropzone { display: flex; min-height: 132px; width: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 1px dashed var(--line-strong); border-radius: 12px; background: var(--color-surface); padding: 16px; text-align: center; transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease; }
	.form-dropzone:hover, .form-dropzone:focus-visible, .form-dropzone-active { border-color: var(--color-primary); background: var(--color-primary-soft); box-shadow: var(--focus-ring); outline: none; }
	.form-dropzone:disabled { cursor: not-allowed; opacity: 0.6; }
	.form-file-row { display: flex; min-width: 0; align-items: center; gap: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--color-surface); padding: 8px; }
	.form-file-thumb { display: flex; width: 48px; height: 60px; flex: 0 0 48px; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; background: var(--color-bg); }
	.form-page-badge, .form-file-status { flex: 0 0 auto; border-radius: 999px; background: var(--color-bg); padding: 2px 7px; color: var(--color-text-muted); font-size: var(--font-size-helper); font-weight: 600; }
	.form-file-new { background: var(--color-primary-soft); color: var(--color-success); }
	.form-file-action { display: flex; width: var(--control-height); height: var(--control-height); flex: 0 0 var(--control-height); align-items: center; justify-content: center; border-radius: var(--radius-control); color: var(--color-text-muted); transition: background-color var(--motion-fast), color var(--motion-fast); }
	.form-file-action:hover:not(:disabled) { background: var(--color-primary-soft); color: var(--color-primary-hover); }
	.form-file-action:focus-visible { outline: 2px solid var(--color-primary-hover); outline-offset: 1px; }
	.form-file-action:disabled { cursor: not-allowed; opacity: 0.35; }
	.form-file-remove:hover:not(:disabled) { background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface)); color: var(--color-danger); }
	:global(.ui-modal-panel:has(.form-editor-body)) { width: min(640px, 94vw); max-width: none; max-height: 90vh; border-radius: 16px; }
	:global(.ui-modal-panel:has(.form-editor-body) > div:first-child) { position: sticky; top: 0; z-index: 2; min-height: 92px; align-items: flex-start; padding: 18px 24px 42px; background: var(--color-surface); border-radius: 16px 16px 0 0; }
	:global(.ui-modal-panel:has(.form-editor-body) > div:first-child::after) { position: absolute; top: 48px; left: 24px; color: var(--color-text-muted); font-size: 12px; content: 'Fill in the details and upload the form files.'; }
	:global(.ui-modal-panel:has(.editor-editing) > div:first-child::after) { content: 'Update the details and files for this form.'; }
	:global(.ui-modal-panel:has(.form-editor-body) > div:first-child button:focus-visible) { outline: 2px solid var(--color-primary-hover); outline-offset: 2px; }
	:global(.ui-modal-panel:has(.form-editor-body) > div:nth-child(2)) { overscroll-behavior: contain; padding: 20px 24px; }
	:global(.ui-modal-panel:has(.form-editor-body) > div:last-child) { position: sticky; bottom: 0; z-index: 2; background: var(--color-surface); border-radius: 0 0 16px 16px; }
	@media (min-width: 640px) {
		.library-filters { grid-template-columns: minmax(0, 1fr) minmax(12rem, 16rem); align-items: center; padding: var(--space-4); }
	}
	@media (max-width: 380px) {
		:global(.form-library-card.ui-card) { padding: var(--space-4); }
		.library-primary-actions { gap: var(--space-2); }
		.library-primary-actions :global(.ui-button), .library-primary-actions :global(.row-menu-trigger) { padding-inline: var(--space-1); font-size: var(--font-size-helper); }
	}
	@media (max-width: 599px) {
		.library-filters { grid-template-columns: minmax(0, 1fr); }
		:global(.ui-modal-backdrop:has(.library-preview-content)) { align-items: stretch; padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px); }
		:global(.ui-modal-panel:has(.library-preview-content)) { width: 100%; height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); max-height: 100dvh; border-radius: 0; }
		:global(.ui-modal-panel:has(.library-preview-content) > .modal-header) { padding-top: max(var(--space-3), env(safe-area-inset-top, 0px)); }
		:global(.ui-modal-panel:has(.library-preview-content) > .modal-body) { padding: var(--space-3); }
		:global(.ui-modal-panel:has(.library-preview-content) > .modal-footer) { padding-bottom: max(var(--space-3), env(safe-area-inset-bottom, 0px)); }
		.library-preview-content { gap: var(--space-2); }
		.library-preview-content :global(.pdf-viewer) { height: auto; min-height: 0; }
		:global(.ui-modal-backdrop:has(.form-editor-body)) { align-items: flex-end; padding: 0; }
		:global(.ui-modal-panel:has(.form-editor-body)) { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 16px 16px 0 0; }
		:global(.ui-modal-panel:has(.form-editor-body) > div:first-child) { border-radius: 16px 16px 0 0; padding-right: 18px; padding-left: 18px; }
		:global(.ui-modal-panel:has(.form-editor-body) > div:first-child::after) { left: 18px; }
		:global(.ui-modal-panel:has(.form-editor-body) > div:nth-child(2)) { padding-right: 18px; padding-left: 18px; }
		.form-file-row { flex-wrap: wrap; }
		.form-file-row > :global(.form-file-action) { width: 36px; height: 36px; }
	}
</style>
