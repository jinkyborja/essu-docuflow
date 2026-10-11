<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
 import PageHeader from '$lib/components/ui/PageHeader.svelte';
 import TextField from '$lib/components/ui/TextField.svelte';
 import SelectField from '$lib/components/ui/SelectField.svelte';
 import TextArea from '$lib/components/ui/TextArea.svelte';
 import FileDrop from '$lib/components/ui/FileDrop.svelte';
 import FormSection from '$lib/components/ui/FormSection.svelte';
 import FormActions from '$lib/components/ui/FormActions.svelte';
 import {validateForm} from '$lib/components/ui/form-validation';
	import RowMenu from '$lib/components/ui/RowMenu.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { showToast } from '$lib/stores/toasts';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadError from '$lib/components/ui/LoadError.svelte';
	import { formCategories } from '$lib/data/forms';
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
	let title = $state(''); let categoryValue = $state(''); let newCategory = $state(''); let code = $state(''); let description = $state('');
	let initialTitle = $state(''); let initialDownloadName = $state(''); let editorAttempted = $state(false);
	let dragging = $state(false); let activeUploadName = $state(''); let titleInput = $state<HTMLInputElement>(); let editorTrigger = $state<HTMLElement | null>(null);
	type DraftFile = { file?: File; page_no: number; storage_path: string | null; public_url: string; name: string; type: string; size?: number; preview?: string };
	let pickerFiles = $state<File[]>([]);
	let draftFiles = $state<DraftFile[]>([]); let inlineError = $state(''); let fileInput = $state<HTMLInputElement>();
	const categories = $derived(['All categories', ...new Set([...formCategories, 'Prospectus', ...forms.map((f) => f.category)])]);
	const previewFiles = $derived(draftFiles.filter((f) => isPreview(f.name)));
	const editableFiles = $derived(draftFiles.filter((f) => !isPreview(f.name)));
	const filtered = $derived(forms.filter((f) => (category === 'All categories' || f.category === category) && `${f.title} ${f.category} ${f.code ?? ''}`.toLowerCase().includes(query.toLowerCase())));
	const resolvedCategory = $derived(categoryValue === '__new' ? newCategory.trim() : categoryValue.trim());
	const editorDirty = $derived(editing ? hasChanges() : !!(title || categoryValue || newCategory || code || description || draftFiles.length));
	const editorValid = $derived(!!title.trim() && !!resolvedCategory && !!description.trim() && description.length <= 4000 && draftFiles.length >= 1 && draftFiles.length <= 5 && (!editing || editorDirty));
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
		setTimeout(() => editorTrigger?.focus(), 150);
	}
	function requestCloseEditor() {
		if (saving) return;
		if (editorDirty) discardOpen = true;
		else closeEditor();
	}
	function addFiles(list: FileList | File[] | null) {
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
		if (!editorValid) { inlineError = 'Complete the required fields and add between 1 and 5 files.'; return; }
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
</script>



<svelte:head><title>Forms | Portal</title></svelte:head>
<div class="space-y-5">
	{#if canManage}<PageHeader title="Forms" description="Keep official forms available and ready for students to use.">{#snippet action()}<Button onclick={()=>openEditor()} icon="fa-solid fa-plus">Add form</Button>{/snippet}</PageHeader>{/if}
	<div class="flex flex-col gap-3 sm:flex-row"><label class="relative min-w-0 flex-1"><span class="sr-only">Search forms</span><i class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-gray-400"></i><input bind:value={query} class="h-11 w-full rounded-lg border border-gray-200 px-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" placeholder="Search forms" /></label><label class="sm:w-56"><span class="sr-only">Filter by category</span><select bind:value={category} class="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30">{#each categories as item}<option>{item}</option>{/each}</select></label></div>
	{#if loading}<div class="grid gap-4 xl:grid-cols-2" aria-live="polite">{#each [1, 2, 3, 4] as _}<div class="animate-pulse rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><div class="flex gap-3"><div class="h-[72px] w-14 rounded-lg bg-gray-100"></div><div class="flex-1 space-y-3 py-2"><div class="h-4 w-1/2 rounded bg-gray-100"></div><div class="h-3 w-1/3 rounded bg-gray-100"></div><div class="h-3 w-2/3 rounded bg-gray-100"></div></div></div></div>{/each}<span class="sr-only">Loading forms</span></div>
	{:else if loadError}<LoadError message="We couldn’t load the forms. Please try again." onretry={refresh} />
	{:else if forms.length === 0 && canManage}<EmptyState message="No forms yet" description="Add a form to make it available to staff." icon="fa-solid fa-file-circle-plus" /><div class="-mt-12 pb-8 flex justify-center"><Button onclick={() => openEditor()} icon="fa-solid fa-plus">Add form</Button></div>
	{:else if filtered.length === 0}<EmptyState message={forms.length ? 'No forms found' : 'No forms available yet'} description={forms.length ? 'Try another search or category.' : 'Check back later or contact the Graduate School office.'} /><div class="flex justify-center pb-6">{#if forms.length}<Button variant="secondary" onclick={() => { query = ''; category = 'All categories'; }}>Clear filters</Button>{:else}<Button variant="secondary" onclick={refresh}>Try again</Button>{/if}</div>
	{:else}<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">{#each filtered as form (form.form_id)}
		<article class="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"><div class="flex items-start justify-between gap-3"><div class="flex min-w-0 items-start gap-3"><button class="flex h-[72px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-2xl text-gray-400 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => { selected = form; viewOpen = true; }} aria-label={`View ${form.title}`} title={`View ${form.title}`}>
			<i class="fa-solid {previewPages(form).length ? 'fa-file-lines' : editableFilesFor(form).some((file) => ['doc','docx'].includes(extension(file.name))) ? 'fa-file-word' : editableFilesFor(form).length ? 'fa-file-excel' : 'fa-file-lines'}" aria-hidden="true"></i></button>
			<div class="min-w-0"><h3 class="text-xl font-semibold text-gray-800 leading-snug">{form.title}</h3><div class="mt-1 flex flex-wrap items-center gap-2"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {categoryClass(form.category) || 'bg-gray-100 text-gray-700'}">{form.category}</span>{#if form.code}<span class="text-xs text-gray-500">{form.code}</span>{/if}</div><p class="mt-2 line-clamp-2 text-sm text-gray-600">{form.description}</p><p class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">{#if previewPages(form).length}<span class="rounded-full border border-essu-green/20 bg-essu-green/5 px-2 py-0.5 text-essu-green">{previewPages(form).length} {previewPages(form).length === 1 ? 'page' : 'pages'}</span>{/if}{#if editableFilesFor(form).length}<span class="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-800">Editable</span>{/if}</p></div></div></div>
				<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3"><Button variant="secondary" size="sm" onclick={() => { selected = form; viewOpen = true; }} icon="fa-solid fa-eye">View</Button>{#each editableFilesFor(form) as file}<Button variant="secondary" size="sm" onclick={() => downloadEditable(form, file)} icon="fa-solid fa-download">{editableLabel(file)}</Button>{/each}{#if previewPages(form).length}<Button variant="secondary" size="sm" onclick={() => downloadPreview(form)} icon="fa-solid fa-download">Download preview</Button>{/if}<span class="ml-auto flex flex-wrap gap-2">{#each [...new Set(form.files.map(file=>extension(file.name).toUpperCase()))] as type}<span class="file-type-chip">{type}</span>{/each}{#if canManage}<RowMenu label={'Actions for ' + form.title} items={[{label: 'Edit', onselect: () => openEditor(form)}, {label: 'Delete', danger: true, onselect: () => { deleting = form; deleteOpen = true; }}]} />{/if}</span></div>
			</article>
	{/each}</div>{/if}
</div>

{#if canManage}<Modal open={modalOpen} title={editing ? 'Edit form' : 'Add form'} size="lg" onclose={requestCloseEditor} closeDisabled={saving} trackDirty={false} width="640px">
	{#snippet body()}
		<form use:validateForm id="form-editor" class="form-editor-body space-y-6 {editing ? 'editor-editing' : ''}" onsubmit={(e) => { e.preventDefault(); void save(); }}>
<FormSection title="Details"><TextField id="form-title" label="Title" bind:value={title} maxlength={200} required disabled={saving} validator={value=>value.trim()?'':'Enter a title.'}/><div class="grid gap-4 sm:grid-cols-2"><SelectField id="form-category" label="Category" bind:value={categoryValue} required disabled={saving}><option value="">Choose category</option>{#each categories.filter(item=>item!=='All categories') as item}<option value={item}>{item}</option>{/each}<option value="__new">New category…</option></SelectField><TextField id="form-code" label="Form code / version" bind:value={code} placeholder="e.g. ESSU-ACAD-213 v5" disabled={saving}/>{#if categoryValue==='__new'}<TextField id="new-category" label="New category" bind:value={newCategory} maxlength={100} required disabled={saving}/>{/if}</div><TextArea id="form-description" label="Description" bind:value={description} maxlength={4000} rows={5} required disabled={saving} helper="Say what the form is for and who signs it."/><p class="field-helper text-right">{description.length} / 4000</p></FormSection>
			<section class="space-y-4 border-t border-gray-200 pt-5" aria-labelledby="files-heading">
				<div class="flex items-center justify-between gap-3"><h3 id="files-heading" class="form-section-label">Files</h3><span class="text-xs font-medium text-gray-500">{draftFiles.length} of 5 files</span></div>
<FileDrop label="Form files" bind:files={pickerFiles} multiple showFiles={false} accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.doc,.xlsx,.xls" maxSize={10*1024*1024} maxFiles={Math.max(1,5-draftFiles.length)} required={draftFiles.length===0} disabled={saving || draftFiles.length>=5} progress={saving ? progress:null} helper="Images or PDF for preview. Word or Excel for editable versions. Up to 5 files, 10 MB each." onchange={(_,files)=>{addFiles(files);pickerFiles=[];}} />
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
	{#snippet footer()}<FormActions><Button variant="secondary" onclick={requestCloseEditor} disabled={saving}>Cancel</Button><Button type="submit" form="form-editor" disabled={!!editing && !editorDirty} disabledReason="Make a change first" loading={saving}>{editing ? 'Save changes':'Add form'}</Button></FormActions>{/snippet}
</Modal>
<ConfirmDialog open={discardOpen} title="Discard changes?" message="Your unsaved changes will be lost." confirmLabel="Discard changes" cancelLabel="Keep editing" onclose={cancelDiscard} onconfirm={closeEditor} />
<ConfirmDialog open={deleteOpen} title="Delete form" message={'Delete “' + (deleting?.title ?? 'this form') + '”? Its files will be removed. This cannot be undone.'} confirmLabel="Delete form" loading={saving} onclose={() => deleteOpen = false} onconfirm={() => void deleteForm()} />
{/if}
<Modal open={viewOpen} title={selected?.title ?? 'View form'} size="xl" onclose={() => viewOpen = false}>
	{#snippet body()}<div class="space-y-4">{#if selected?.description}<p class="text-gray-700">{selected.description}</p>{/if}{#if selected && previewPages(selected).length === 0}<div class="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">Preview isn't available for Word files. Download the editable version to open it.</div>{/if}{#each selected ? previewPages(selected) : [] as file}<div><p class="mb-2 text-sm font-medium">Page {file.page_no}</p>{#if extension(file.name) === 'pdf'}<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-6"><i class="fa-solid fa-file-pdf text-3xl text-red-500"></i><a href={file.public_url} target="_blank" rel="noopener" class="text-essu-green underline">Open PDF</a></div>{:else}<img src={file.public_url} alt={`${selected?.title} page ${file.page_no}`} class="mx-auto max-h-[65vh] rounded border border-gray-200 object-contain" />{/if}</div>{/each}</div>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={() => viewOpen = false}>Close</Button>{#if selected}{#each editableFilesFor(selected) as file}<Button variant="secondary" onclick={() => downloadEditable(selected!, file)} icon="fa-solid fa-download">{editableLabel(file)}</Button>{/each}{#if previewPages(selected).length}<Button variant="secondary" onclick={() => downloadPreview(selected!)} icon="fa-solid fa-download">Download preview</Button>{/if}{/if}{/snippet}
</Modal>


<style>
	.form-error { display: flex; align-items: flex-start; gap: 6px; margin-top: 6px; color: var(--color-danger); font-size: 12px; }
	.form-section-label { color: var(--color-text-muted); font-size: var(--type-helper); font-weight: var(--weight-semibold); letter-spacing: 0.1em; text-transform: uppercase; }
	.form-file-row { display: flex; min-width: 0; align-items: center; gap: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--color-surface); padding: 8px; }
	.form-file-thumb { display: flex; width: 48px; height: 60px; flex: 0 0 48px; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; background: var(--color-surface-muted); }
	.form-page-badge, .form-file-status { flex: 0 0 auto; border-radius: 999px; background: var(--color-surface-muted); padding: 2px 7px; color: var(--color-text-muted); font-size: var(--type-helper); font-weight: 600; }
	.form-file-new { background: var(--color-success-soft); color: var(--color-success); }
	.form-file-action { display: flex; width: 40px; height: 40px; flex: 0 0 40px; align-items: center; justify-content: center; border-radius: 8px; color: var(--color-text-muted); transition: background var(--motion-fast), color var(--motion-fast); }
	.form-file-action:hover:not(:disabled) { background: var(--color-primary-soft); color: var(--color-primary); }
	.form-file-action:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
	.form-file-action:disabled { cursor: not-allowed; background: var(--color-surface-muted);color:var(--color-text-muted); }
	.form-file-remove:hover:not(:disabled) { background: var(--color-danger-soft); color: var(--color-danger); }
 .file-type-chip {display:inline-flex;align-items:center;min-height:24px;padding:0 var(--space-2);border:1px solid var(--color-border);border-radius:var(--radius-pill);background:var(--color-surface-muted);color:var(--color-text-muted);font-size:var(--type-helper);}
 @media(max-width:639px){.form-file-row {flex-wrap:wrap;}}
</style>