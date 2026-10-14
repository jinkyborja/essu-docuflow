<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { showToast } from '$lib/stores/toasts';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadError from '$lib/components/ui/LoadError.svelte';
	import { formCategories } from '$lib/data/forms';
	import TextField from './TextField.svelte';
	import TextArea from './TextArea.svelte';
	import FormSection from './FormSection.svelte';
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
	let searchField = $state('');
	let downloadFor = $state<number | null>(null);
	let pdfBusy = $state<number | null>(null), pdfErrorFor = $state<number | null>(null), pdfError = $state('');
	let pdfPreview = $state(''), pdfPreviewLoading = $state(false), pdfPreviewError = $state('');
	onDestroy(() => { if (pdfPreview) URL.revokeObjectURL(pdfPreview); });
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
	const editorValid = $derived(!!title.trim() && !!resolvedCategory && !!description.trim() && description.length <= 4000 && draftFiles.length >= 1 && draftFiles.length <= 5 && hasPdf && (!editing || editorDirty));
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
	function editableLabel(file: FormFile) { const suffix = extension(file.name).toUpperCase(); return `Download ${suffix}`; }
	async function save() {
		editorAttempted = true;
		const realCategory = resolvedCategory;
		if (!editorValid) { inlineError = 'Complete the required fields and include a PDF version among 1 to 5 files.'; return; }
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
	function editableFilesFor(form: FormRecord) { return form.files.filter((file) => !isPreview(file.name)); }
	function downloadEditable(form: FormRecord, file: FormFile) { download(file.public_url, outputName(form, file)); }
	function downloadPreview(form: FormRecord) { for (const file of previewPages(form)) download(file.public_url, outputName(form, file)); }
	function downloadChoice(form: FormRecord, pageNo: number | 'all') {
		if (pageNo === 'all') previewPages(form).forEach((file) => download(file.public_url, outputName(form, file)));
		else { const file = previewPages(form).find((item) => item.page_no === pageNo); if (file) download(file.public_url, outputName(form, file)); }
		downloadFor = null;
	}
	function cancelDiscard() { discardOpen = false; void tick().then(() => document.getElementById('form-title')?.focus()); }
	async function formPdf(form: FormRecord): Promise<Blob> {
		const response = await fetch('/api/forms/' + form.form_id + '/download');
		if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error ?? 'Could not load the PDF. Please try again.'); }
		const bytes = await response.arrayBuffer();
		if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('The file is not a valid PDF. Please contact the Graduate School office.');
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
		selected = form; viewOpen = true;
		if (canManage) return;
		if (pdfPreview) URL.revokeObjectURL(pdfPreview);
		pdfPreview = ''; pdfPreviewLoading = true; pdfPreviewError = '';
		try {
			const blob = await formPdf(form);
			if (viewOpen && selected?.form_id === form.form_id) pdfPreview = URL.createObjectURL(blob);
		} catch (problem) { pdfPreviewError = problem instanceof Error ? problem.message : 'Could not preview the PDF.'; }
		finally { pdfPreviewLoading = false; }
	}

</script>



<svelte:head><title>Forms | Portal</title></svelte:head>
<div class="space-y-5">
	{#if canManage}<header class="page-toolbar flex flex-wrap items-center justify-between gap-4"><p class="text-sm text-gray-500">Official forms library</p><Button onclick={() => openEditor()} icon="fa-solid fa-plus">Add form</Button></header>{/if}
	<div class="flex flex-col gap-3 sm:flex-row"><label class="relative min-w-0 flex-1"><span class="sr-only">Search forms</span><i class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-gray-400"></i><input bind:value={query} class="h-11 w-full rounded-lg border border-gray-200 px-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" placeholder="Search forms" /></label><label class="sm:w-56"><span class="sr-only">Filter by category</span><select bind:value={category} class="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30">{#each categories as item}<option>{item}</option>{/each}</select></label></div>
	{#if loading}<div class="grid gap-4 xl:grid-cols-2" aria-live="polite">{#each [1, 2, 3, 4] as _}<Card><Skeleton variant="text" lines={3} label="Loading form" /></Card>{/each}</div>
	{:else if loadError}<LoadError message="We couldn’t load the forms. Please try again." onretry={refresh} />
	{:else if forms.length === 0 && canManage}<EmptyState message="No forms yet" description="Add a form to make it available to staff." icon="fa-solid fa-file-circle-plus" /><div class="-mt-12 pb-8 flex justify-center"><Button onclick={() => openEditor()} icon="fa-solid fa-plus">Add form</Button></div>
	{:else if filtered.length === 0}<EmptyState message={forms.length ? 'No forms found' : 'No forms available yet'} description={forms.length ? 'Try another search or category.' : 'Check back later or contact the Graduate School office.'} /><div class="flex justify-center pb-6">{#if forms.length}<Button variant="secondary" onclick={() => { query = ''; category = 'All categories'; }}>Clear filters</Button>{:else}<Button variant="secondary" onclick={refresh}>Try again</Button>{/if}</div>
	{:else}<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">{#each filtered as form (form.form_id)}
		<Card class="form-library-card" hover>
			<div class="library-card-heading"><span class="library-category">{form.category}</span>{#if form.code}<span class="library-code">{form.code}</span>{/if}</div>
			<h3 class="library-title">{form.title}</h3><p class="library-description">{form.description}</p>{#if pdfErrorFor === form.form_id}<p role="alert" class="mt-2 text-sm text-red-700">{pdfError}</p>{/if}
			{#if previewPages(form).length}<p class="library-meta">{previewPages(form).length} {previewPages(form).length === 1 ? 'preview page' : 'preview pages'}</p>{/if}
			{#snippet footer()}
				<div class="library-footer-actions"><div class="library-file-actions"><Button variant="secondary" onclick={() => void viewForm(form)} icon="fa-solid fa-eye">View</Button>{#if !canManage}<Button variant="secondary" loading={pdfBusy === form.form_id} disabled={pdfBusy !== null && pdfBusy !== form.form_id} onclick={() => void downloadPdf(form)} icon="fa-solid fa-download">Download <span class="library-file-type">PDF</span></Button>{:else}{#each editableFilesFor(form) as file}<Button variant="secondary" title={file.name} onclick={() => downloadEditable(form, file)} icon="fa-solid fa-download">Download <span class="library-file-type">{extension(file.name).toUpperCase()}</span></Button>{/each}{#if previewPages(form).length}<Button variant="secondary" onclick={() => downloadPreview(form)} icon="fa-solid fa-download">Download preview <span class="library-file-type">{[...new Set(previewPages(form).map(file => extension(file.name).toUpperCase()))].join(' / ')}</span></Button>{/if}{/if}</div>
				{#if canManage}<RowMenu label={'Actions for ' + form.title} items={[{label: 'Edit', onselect: () => openEditor(form)}, {label: 'Delete', danger: true, onselect: () => { deleting = form; deleteOpen = true; }}]} />{/if}</div>
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
	{#snippet footer()}<Button variant="secondary" onclick={requestCloseEditor} disabled={saving} class="rounded-[10px]">Cancel</Button><Button onclick={() => void save()} disabled={!editorValid || saving} loading={saving} class="rounded-[10px]">{editing ? 'Save changes' : 'Add form'}</Button>{/snippet}
</Modal>
<ConfirmDialog open={discardOpen} title="Discard changes?" message="Your unsaved changes will be lost." confirmLabel="Discard changes" cancelLabel="Keep editing" onclose={cancelDiscard} onconfirm={closeEditor} />
<ConfirmDialog open={deleteOpen} title="Delete form" message={'Delete “' + (deleting?.title ?? 'this form') + '”? Its files will be removed. This cannot be undone.'} confirmLabel="Delete form" loading={saving} onclose={() => deleteOpen = false} onconfirm={() => void deleteForm()} />
{/if}
<Modal open={viewOpen} title={selected?.title ?? 'View form'} size="xl" onclose={() => viewOpen = false}>
	{#snippet body()}<div class="space-y-4">{#if selected?.description}<p class="text-gray-700">{selected.description}</p>{/if}{#if !canManage}{#if pdfPreviewLoading}<p role="status">Loading PDF preview?</p>{:else if pdfPreviewError}<LoadError message={pdfPreviewError} onretry={() => selected && void viewForm(selected)} />{:else if pdfPreview}<iframe src={pdfPreview} title={selected?.title ?? 'Form preview'} class="h-[65dvh] w-full rounded-lg border border-gray-200"></iframe>{/if}{:else}{#if selected && previewPages(selected).length === 0}<div class="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">Preview isn't available for Word files. Download the editable version to open it.</div>{/if}{#each selected ? previewPages(selected) : [] as file}<div><p class="mb-2 text-sm font-medium">Page {file.page_no}</p>{#if extension(file.name) === 'pdf'}<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-6"><i class="fa-solid fa-file-pdf text-3xl text-red-500"></i><a href={file.public_url} target="_blank" rel="noopener" class="text-essu-green underline">Open PDF</a></div>{:else}<img src={file.public_url} alt={`${selected?.title} page ${file.page_no}`} class="mx-auto max-h-[65vh] rounded border border-gray-200 object-contain" />{/if}</div>{/each}{/if}</div>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={() => viewOpen = false}>Close</Button>{#if selected}{#if !canManage}<Button onclick={() => selected && void downloadPdf(selected)} loading={pdfBusy === selected.form_id} icon="fa-solid fa-download">Download PDF</Button>{:else}{#each editableFilesFor(selected) as file}<Button onclick={() => downloadEditable(selected!, file)} icon="fa-solid fa-download">{editableLabel(file)}</Button>{/each}{#if previewPages(selected).length}<Button onclick={() => downloadPreview(selected!)} icon="fa-solid fa-download">Download preview</Button>{/if}{/if}{/if}{/snippet}
</Modal>


<style>
	:global(.form-library-card.ui-card) { display: flex; flex-direction: column; }
	:global(.form-library-card > .card-footer) { justify-content: space-between; margin-top: auto; padding-top: var(--space-4); }
	.library-card-heading { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); }
	.library-category, .library-file-type { display: inline-flex; align-items: center; padding: var(--space-1) var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-primary-soft); color: var(--color-primary); font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); line-height: var(--line-height); }
	.library-code, .library-meta { color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.library-title { margin: 0; color: var(--color-text); font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); line-height: var(--line-height); }
	.library-description { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; margin: var(--space-3) 0; color: var(--color-text-muted); font-size: var(--font-size-body); line-height: var(--line-height); }
	.library-meta { margin: 0 0 var(--space-4); }
	.library-footer-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); width: 100%; }
	.library-file-actions { display: flex; flex: 1 1 auto; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding-top: var(--space-4); }
	.library-file-type { padding-block: 0; background: var(--color-bg); color: var(--color-text-muted); }
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
	@media (max-width: 599px) {
		.library-footer-actions { align-items: stretch; }
		.library-footer-actions :global(.row-menu-trigger) { min-height: 44px; }
		:global(.ui-modal-backdrop:has(.form-editor-body)) { align-items: flex-end; padding: 0; }
		:global(.ui-modal-panel:has(.form-editor-body)) { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 16px 16px 0 0; }
		:global(.ui-modal-panel:has(.form-editor-body) > div:first-child) { border-radius: 16px 16px 0 0; padding-right: 18px; padding-left: 18px; }
		:global(.ui-modal-panel:has(.form-editor-body) > div:first-child::after) { left: 18px; }
		:global(.ui-modal-panel:has(.form-editor-body) > div:nth-child(2)) { padding-right: 18px; padding-left: 18px; }
		.form-file-row { flex-wrap: wrap; }
		.form-file-row > :global(.form-file-action) { width: 36px; height: 36px; }
	}
</style>
