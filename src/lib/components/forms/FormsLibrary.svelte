<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { formCategories, type FormRecord, type FormFile } from '$lib/data/forms';
	let forms = $state<FormRecord[]>([]);
	let loading = $state(true);
	let { canManage }: { canManage: boolean } = $props();
	let query = $state(''); let category = $state('All categories');
	let modalOpen = $state(false); let deleteOpen = $state(false); let viewOpen = $state(false); let discardOpen = $state(false);
	let editing = $state<FormRecord | null>(null); let selected = $state<FormRecord | null>(null);
	let deleting = $state<FormRecord | null>(null); let saving = $state(false); let progress = $state(0);
	let toastMessage = $state(''); let toastError = $state(false); let searchField = $state('');
	let downloadFor = $state<number | null>(null);
	let title = $state(''); let categoryValue = $state(''); let newCategory = $state(''); let code = $state(''); let description = $state('');
	let initialTitle = $state(''); let initialDownloadName = $state(''); let editorAttempted = $state(false);
	let dragging = $state(false); let activeUploadName = $state(''); let titleInput = $state<HTMLInputElement>(); let editorTrigger = $state<HTMLElement | null>(null);
	type DraftFile = { file?: File; page_no: number; storage_path: string | null; public_url: string; name: string; type: string; preview?: string };
	let draftFiles = $state<DraftFile[]>([]); let inlineError = $state(''); let fileInput = $state<HTMLInputElement>();
	const categories = $derived(['All categories', ...new Set([...formCategories, ...forms.map((f) => f.category)])]);
	const filtered = $derived(forms.filter((f) => (category === 'All categories' || f.category === category) && `${f.title} ${f.category} ${f.code ?? ''}`.toLowerCase().includes(query.toLowerCase())));
	const resolvedCategory = $derived(categoryValue === '__new' ? newCategory.trim() : categoryValue.trim());
	const editorDirty = $derived(editing ? hasChanges() : !!(title || categoryValue || newCategory || code || description || draftFiles.length));
	const editorValid = $derived(!!title.trim() && !!resolvedCategory && !!description.trim() && description.length <= 4000 && draftFiles.length >= 1 && draftFiles.length <= 5 && (!editing || editorDirty));
	onMount(() => { void refresh(); });
	async function refresh() {
		loading = true;
		try { const response = await fetch('/api/forms'); if (!response.ok) throw new Error((await response.json()).error || 'Could not load forms.'); forms = await response.json(); }
		catch (e) { toast((e as Error).message, true); } finally { loading = false; }
	}
	function toast(message: string, error = false) { toastMessage = message; toastError = error; setTimeout(() => toastMessage = '', 4000); }
	function slug(value: string) { return `ESSU-${value.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').toLowerCase() || 'form'}`; }
	function openEditor(form?: FormRecord) {
		editorTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		editing = form ?? null; title = form?.title ?? ''; initialTitle = title; initialDownloadName = form?.download_name ?? ''; categoryValue = form?.category ?? ''; newCategory = ''; code = form?.code ?? ''; description = form?.description ?? ''; editorAttempted = false; inlineError = ''; discardOpen = false;
		draftFiles = form ? form.files.map((f) => ({ ...f, name: f.public_url.split('/').pop() || `Page ${f.page_no}`, type: f.public_url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' })) : [];
		modalOpen = true;
		void tick().then(() => titleInput?.focus());
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
			const ext = file.name.split('.').pop()?.toLowerCase();
			if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext ?? '') || file.size > 5 * 1024 * 1024 || !file.size) { inlineError = `${file.name}: use JPG, PNG, WebP or PDF up to 5 MB.`; continue; }
			if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) { inlineError = `${file.name}: unsupported file type.`; continue; }
			draftFiles = [...draftFiles, { file, page_no: draftFiles.length + 1, storage_path: null, public_url: '', name: file.name, type: file.type, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }];
		}
	}
	function moveFile(i: number, direction: number) { const target = i + direction; if (target < 0 || target >= draftFiles.length) return; const next = [...draftFiles]; [next[i], next[target]] = [next[target], next[i]]; draftFiles = next.map((f, index) => ({ ...f, page_no: index + 1 })); }
	async function save() {
		editorAttempted = true;
		const realCategory = resolvedCategory;
		if (!editorValid) { inlineError = 'Complete the required fields and add between 1 and 5 files.'; return; }
		saving = true; progress = 0; inlineError = '';
		try {
			const nextFiles: (FormFile & { name?: string; type?: string })[] = draftFiles.map((f) => ({ page_no: f.page_no, storage_path: f.storage_path, public_url: f.public_url, name: f.name, type: f.type }));
			const newOnes = draftFiles.filter((f) => f.file);
			if (newOnes.length) {
				const urlResponse = await fetch('/api/forms/upload-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files: newOnes.map((f) => ({ name: f.file!.name, type: f.file!.type, size: f.file!.size })) }) });
				const result = await urlResponse.json(); if (!urlResponse.ok) throw new Error(result.error || 'Could not prepare file upload.');
				for (let i = 0; i < newOnes.length; i++) {
					activeUploadName = newOnes[i].name;
					const target = nextFiles.find((f) => f.name === newOnes[i].name && !f.storage_path && !f.public_url);
					const upload = result.uploads[i]; const response = await fetch(upload.signedUrl, { method: 'PUT', headers: { 'content-type': upload.type }, body: newOnes[i].file });
					if (!response.ok) throw new Error(`Upload failed for ${upload.name}.`);
					if (target) { target.storage_path = upload.path; target.public_url = upload.publicUrl; }
					progress = Math.round(((i + 1) / newOnes.length) * 100);
				}
			}
			const body = { title, category: realCategory, code: code.trim() || null, description, fields: editing ? editing.fields : [], download_name: editing && title === initialTitle ? initialDownloadName : slug(title), files: nextFiles.map((f, i) => ({ page_no: i + 1, storage_path: f.storage_path, public_url: f.public_url })) };
			const response = await fetch(editing ? `/api/forms/${editing.form_id}` : '/api/forms', { method: editing ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
			const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save form.');
			closeEditor(); toast(editing ? 'Form updated.' : 'Form added.'); await refresh();
		} catch (e) { inlineError = (e as Error).message; } finally { saving = false; activeUploadName = ''; }
	}
	async function deleteForm() { if (!deleting) return; saving = true; try { const response = await fetch(`/api/forms/${deleting.form_id}`, { method: 'DELETE' }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not delete form.'); deleteOpen = false; toast('Form deleted.'); await refresh(); } catch (e) { toast((e as Error).message, true); } finally { saving = false; } }
	function download(url: string, name: string) { const a = document.createElement('a'); a.href = url; a.download = name; a.target = '_blank'; a.rel = 'noopener'; a.click(); }
	function downloadMenu(form: FormRecord) { if (form.files.length <= 1) { download(form.files[0]?.public_url ?? '', form.download_name); return; } downloadFor = downloadFor === form.form_id ? null : form.form_id; }
	function downloadChoice(form: FormRecord, pageNo: number | 'all') {
		if (pageNo === 'all') form.files.forEach((file) => download(file.public_url, `${form.download_name}-page-${file.page_no}`));
		else { const file = form.files.find((item) => item.page_no === pageNo); if (file) download(file.public_url, `${form.download_name}-page-${file.page_no}`); }
		downloadFor = null;
	}
	function trapModalFocus(event: KeyboardEvent) {
		if (event.key === 'Escape' && modalOpen) {
			event.stopImmediatePropagation();
			event.preventDefault();
			if (discardOpen) { discardOpen = false; void tick().then(() => titleInput?.focus()); }
			else requestCloseEditor();
			return;
		}
		if (event.key !== 'Tab' || !(modalOpen || deleteOpen || viewOpen || discardOpen)) return;
		const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
		const dialog = dialogs[dialogs.length - 1];
		const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
		if (!focusable?.length) return;
		const first = focusable[0], last = focusable[focusable.length - 1];
		if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
		else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
	}
	function cancelDiscard() { discardOpen = false; void tick().then(() => titleInput?.focus()); }
</script>

<svelte:window onkeydown={trapModalFocus} />

<svelte:head><title>Forms | Portal</title></svelte:head>
<div class="space-y-5">
	<header class="flex flex-wrap items-center justify-between gap-4"><div><h2 class="text-lg font-semibold text-gray-800">Forms Library</h2><p class="mt-0.5 text-sm text-gray-500">{canManage ? 'Browse and manage university forms.' : 'Download the official forms you need for your requests.'}</p></div>{#if canManage}<Button onclick={() => openEditor()} icon="fa-solid fa-plus">Add form</Button>{/if}</header>
	<div class="flex flex-col gap-3 sm:flex-row"><label class="relative min-w-0 flex-1"><span class="sr-only">Search forms</span><i class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-gray-400"></i><input bind:value={query} class="h-11 w-full rounded-lg border border-gray-200 px-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" placeholder="Search forms" /></label><label class="sm:w-56"><span class="sr-only">Filter by category</span><select bind:value={category} class="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30">{#each categories as item}<option>{item}</option>{/each}</select></label></div>
	{#if loading}<div class="grid gap-4 xl:grid-cols-2" aria-live="polite">{#each [1, 2, 3, 4] as _}<div class="animate-pulse rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><div class="flex gap-3"><div class="h-[72px] w-14 rounded-lg bg-gray-100"></div><div class="flex-1 space-y-3 py-2"><div class="h-4 w-1/2 rounded bg-gray-100"></div><div class="h-3 w-1/3 rounded bg-gray-100"></div><div class="h-3 w-2/3 rounded bg-gray-100"></div></div></div></div>{/each}<span class="sr-only">Loading forms</span></div>
	{:else if forms.length === 0 && canManage}<EmptyState message="No forms yet" description="Add a form to make it available to staff." icon="fa-solid fa-file-circle-plus" /><div class="-mt-12 pb-8 flex justify-center"><Button onclick={() => openEditor()} icon="fa-solid fa-plus">Add form</Button></div>
	{:else if filtered.length === 0}<EmptyState message="No forms found" description="Try another search or category." />
	{:else}<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">{#each filtered as form (form.form_id)}
		<article class="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"><div class="flex items-start justify-between gap-3"><div class="flex min-w-0 items-start gap-3"><button class="flex h-[72px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-2xl text-gray-400 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => { selected = form; viewOpen = true; }} aria-label={`View ${form.title}`}>
			<i class="fa-solid fa-file-lines" aria-hidden="true"></i></button>
			<div class="min-w-0"><h3 class="truncate font-semibold text-gray-800">{form.title}</h3><div class="mt-1 flex flex-wrap items-center gap-2"><Badge value={form.category} size="sm" />{#if form.code}<span class="text-xs text-gray-500">{form.code}</span>{/if}</div><p class="mt-2 line-clamp-2 text-sm text-gray-600">{form.description}</p><p class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">{#if form.files.length > 1}<span class="rounded-full border border-essu-green/20 bg-essu-green/5 px-2 py-0.5 text-essu-green">{form.files.length} pages</span>{:else}<span>1 page</span>{/if}</p></div></div>{#if canManage}<div class="flex shrink-0 items-center gap-1"><button onclick={() => openEditor(form)} class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 transition-colors hover:text-essu-green focus:outline-none focus:ring-2 focus:ring-essu-green/30" title="Edit" aria-label={`Edit ${form.title}`}><i class="fa-solid fa-pen text-sm"></i></button><button onclick={() => { deleting = form; deleteOpen = true; }} class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 transition-colors hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-essu-green/30" title="Delete" aria-label={`Delete ${form.title}`}><i class="fa-solid fa-trash text-sm"></i></button></div>{/if}</div>
				<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3"><button class="flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium text-essu-green hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => { selected = form; viewOpen = true; }}><i class="fa-solid fa-eye"></i>View</button><div class="relative"><button aria-expanded={downloadFor === form.form_id} aria-label={`Download ${form.title}`} class="flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium text-essu-green hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => downloadMenu(form)}><i class="fa-solid fa-download"></i>Download</button>{#if downloadFor === form.form_id}<div class="absolute left-0 z-10 mt-1 min-w-40 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">{#each form.files as file}<button class="block w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => downloadChoice(form, file.page_no)}>Page {file.page_no}</button>{/each}<button class="block w-full rounded px-3 py-2 text-left text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => downloadChoice(form, 'all')}>All pages</button></div>{/if}</div></div>
			</article>
	{/each}</div>{/if}
</div>

{#if canManage}<Modal open={modalOpen} title={editing ? 'Edit form' : 'Add form'} size="lg" onclose={requestCloseEditor}>
	{#snippet body()}
		<form id="form-editor" class="form-editor-body space-y-6 {editing ? 'editor-editing' : ''}" onsubmit={(e) => { e.preventDefault(); void save(); }}>
			<section class="space-y-4" aria-labelledby="details-heading">
				<h3 id="details-heading" class="form-section-label">Details</h3>
				<div class="space-y-4">
					<div><label for="form-title" class="form-label">Title <span class="text-red-600">*</span></label><input id="form-title" bind:this={titleInput} bind:value={title} onblur={() => editorAttempted = true} maxlength="200" required class="form-control" aria-invalid={editorAttempted && !title.trim()} />{#if editorAttempted && !title.trim()}<p class="form-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Enter a title.</p>{/if}</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<div><label for="form-category" class="form-label">Category <span class="text-red-600">*</span></label><div class="relative"><select id="form-category" bind:value={categoryValue} onblur={() => editorAttempted = true} required class="form-control appearance-none pr-10" aria-invalid={editorAttempted && !resolvedCategory}><option value="">Choose category</option>{#each categories.filter((c) => c !== 'All categories') as item}<option value={item}>{item}</option>{/each}<option value="__new">New category...</option></select><i class="fa-solid fa-chevron-down pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500" aria-hidden="true"></i></div>{#if editorAttempted && !resolvedCategory}<p class="form-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Choose or enter a category.</p>{/if}</div>
						<div><label for="form-code" class="form-label">Form code / version</label><input id="form-code" bind:value={code} placeholder="e.g. ESSU-ACAD-213 v5" class="form-control" /></div>
						{#if categoryValue === '__new'}<div class="sm:col-span-2"><label for="new-category" class="form-label">New category <span class="text-red-600">*</span></label><input id="new-category" bind:value={newCategory} onblur={() => editorAttempted = true} maxlength="100" class="form-control" aria-invalid={editorAttempted && !newCategory.trim()} />{#if editorAttempted && !newCategory.trim()}<p class="form-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Enter the new category name.</p>{/if}</div>{/if}
					</div>
					<div><label for="form-description" class="form-label">Description <span class="text-red-600">*</span></label><textarea id="form-description" bind:value={description} onblur={() => editorAttempted = true} maxlength="4000" rows="5" required class="form-control min-h-32 resize-y py-3" aria-invalid={editorAttempted && !description.trim()}></textarea><p class="mt-1 text-xs text-gray-500">Shown on the form card. Say what the form is for and who signs it.</p><div class="mt-1 flex justify-end"><span class="text-xs {description.length >= 3800 ? 'text-red-700' : 'text-gray-500'}">{description.length} / 4000</span></div>{#if editorAttempted && !description.trim()}<p class="form-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Enter a description.</p>{/if}</div>
				</div>
			</section>
			<section class="space-y-4 border-t border-gray-200 pt-5" aria-labelledby="files-heading">
				<div class="flex items-center justify-between gap-3"><h3 id="files-heading" class="form-section-label">Files</h3><span class="text-xs font-medium text-gray-500">{draftFiles.length} of 5 files</span></div>
				<button type="button" class="form-dropzone {dragging ? 'form-dropzone-active' : ''}" aria-label="Add form files. Drag files here or browse." disabled={saving} onclick={() => fileInput?.click()} ondragenter={(e) => { e.preventDefault(); dragging = true; }} ondragover={(e) => { e.preventDefault(); dragging = true; }} ondragleave={(e) => { if (e.currentTarget === e.target) dragging = false; }} ondrop={(e) => { e.preventDefault(); dragging = false; addFiles(e.dataTransfer?.files ?? null); }}>
					<i class="fa-solid fa-cloud-arrow-up text-2xl text-essu-green" aria-hidden="true"></i><span class="text-sm font-semibold text-gray-800">Drag files here or <span class="text-essu-green underline">Browse</span></span><span class="text-xs text-gray-500">JPG, PNG, WebP or PDF. Up to 5 files, 5 MB each.</span>
				</button>
				<input bind:this={fileInput} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" multiple class="sr-only" aria-label="Browse form files" disabled={saving} onchange={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ''; }} />
				{#if editorAttempted && draftFiles.length === 0}<p class="form-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Add at least one file.</p>{/if}
				{#if inlineError}<p class="form-error" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{inlineError}</p>{/if}
				<div class="space-y-2">
					{#each draftFiles as file, i (file.page_no + '-' + file.name)}
						<div class="form-file-row">
							<div class="form-file-thumb">{#if file.type === 'application/pdf' || file.public_url.toLowerCase().endsWith('.pdf')}<i class="fa-solid fa-file-pdf text-xl text-gray-500" aria-label="PDF"></i>{:else if file.preview}<img src={file.preview} alt="" class="h-full w-full object-cover object-top" onerror={(e) => { (e.currentTarget as HTMLImageElement).classList.add('hidden'); e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} /><i class="hidden fa-solid fa-file-image text-xl text-gray-400" aria-hidden="true"></i>{:else}<img src={file.public_url} alt="" class="h-full w-full object-cover object-top" onerror={(e) => { (e.currentTarget as HTMLImageElement).classList.add('hidden'); e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} /><i class="hidden fa-solid fa-file-image text-xl text-gray-400" aria-hidden="true"></i>{/if}</div>
							<div class="min-w-0 flex-1"><div class="mb-1 flex items-center gap-2"><span class="form-page-badge">Page {i + 1}</span><span class="truncate text-sm font-medium text-gray-800">{file.name}</span></div><div class="flex items-center gap-2 text-xs text-gray-500">{#if file.file}<span>{(file.file.size / 1024).toFixed(0)} KB</span><span class="form-file-status form-file-new">New</span>{:else}<span class="form-file-status">Existing</span>{/if}</div>{#if saving && activeUploadName === file.name}<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200"><div class="h-full bg-essu-green transition-all" style={`width:${progress}%`}></div></div>{/if}</div>
							<button type="button" aria-label={`Move ${file.name} up`} class="form-file-action" onclick={() => moveFile(i, -1)} disabled={saving || i === 0}><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button><button type="button" aria-label={`Move ${file.name} down`} class="form-file-action" onclick={() => moveFile(i, 1)} disabled={saving || i === draftFiles.length - 1}><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button><button type="button" aria-label={`Remove ${file.name}`} class="form-file-action form-file-remove" onclick={() => draftFiles = draftFiles.filter((_, ix) => ix !== i).map((f, ix) => ({ ...f, page_no: ix + 1 }))} disabled={saving}><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
						</div>
					{/each}
				</div>
			</section>
		</form>
	{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={requestCloseEditor} disabled={saving} class="rounded-[10px]">Cancel</Button><Button onclick={() => void save()} disabled={!editorValid || saving} loading={saving} class="rounded-[10px]">{editing ? 'Save changes' : 'Add form'}</Button>{/snippet}
</Modal>
<Modal open={discardOpen} title="Discard changes?" size="sm" onclose={cancelDiscard}>
	{#snippet body()}<p class="text-sm text-gray-600">Your unsaved changes will be lost.</p>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={cancelDiscard}>Keep editing</Button><Button onclick={closeEditor}>Discard changes</Button>{/snippet}
</Modal>
<Modal open={deleteOpen} title="Delete form" onclose={() => !saving && (deleteOpen = false)}>
	{#snippet body()}<p class="text-gray-700">Delete this form? Its files will be removed. This cannot be undone.</p><p class="mt-2 font-semibold">{deleting?.title}</p>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={() => deleteOpen = false} disabled={saving}>Cancel</Button><Button variant="danger" onclick={() => void deleteForm()} loading={saving}>Delete form</Button>{/snippet}
</Modal>
{/if}
<Modal open={viewOpen} title={selected?.title ?? 'View form'} size="xl" onclose={() => viewOpen = false}>
	{#snippet body()}<div class="space-y-4">{#if selected?.description}<p class="text-gray-700">{selected.description}</p>{/if}{#each selected?.files ?? [] as file}<div><p class="mb-2 text-sm font-medium">Page {file.page_no}</p>{#if file.public_url.toLowerCase().endsWith('.pdf')}<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-6"><i class="fa-solid fa-file-pdf text-3xl text-red-500"></i><a href={file.public_url} target="_blank" rel="noopener" class="text-essu-green underline">Open PDF</a></div>{:else}<img src={file.public_url} alt={`${selected?.title} page ${file.page_no}`} class="mx-auto max-h-[65vh] rounded border border-gray-200 object-contain" />{/if}</div>{/each}</div>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={() => viewOpen = false}>Close</Button>{#if selected}{#if selected.files.length === 1}<Button onclick={() => download(selected!.files[0].public_url, selected!.download_name)} icon="fa-solid fa-download">Download</Button>{:else}<div class="flex flex-wrap gap-2">{#each selected.files as file}<Button variant="secondary" onclick={() => downloadChoice(selected!, file.page_no)}>Page {file.page_no}</Button>{/each}<Button onclick={() => downloadChoice(selected!, 'all')} icon="fa-solid fa-download">All pages</Button></div>{/if}{/if}{/snippet}
</Modal>
{#if toastMessage}<div class="fixed bottom-5 right-5 z-[70] rounded-lg px-4 py-3 text-sm text-white shadow-lg {toastError ? 'bg-red-700' : 'bg-essu-green'}" role="status" aria-live="polite">{toastMessage}</div>{/if}

<style>
	.form-label { display: block; margin-bottom: 6px; color: #26332c; font-size: 13px; font-weight: 600; }
	.form-control { display: block; width: 100%; height: 44px; border: 1px solid var(--line); border-radius: 10px; background: #fff; padding: 0 12px; color: #26332c; font-size: 14px; outline: none; transition: border-color 150ms, box-shadow 150ms; }
	.form-control:hover { border-color: var(--line-strong); }
	.form-control:focus { border-color: var(--green-700, #1f6b4a); box-shadow: 0 0 0 3px rgba(31, 107, 74, 0.18); }
	.form-control[aria-invalid="true"] { border-color: #b42318; }
	.form-error { display: flex; align-items: flex-start; gap: 6px; margin-top: 6px; color: #b42318; font-size: 12px; }
	.form-section-label { color: #64736a; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
	.form-dropzone { display: flex; min-height: 132px; width: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 1px dashed var(--line-strong); border-radius: 12px; background: #fbfdfb; padding: 16px; text-align: center; transition: border-color 150ms, background 150ms, box-shadow 150ms; }
	.form-dropzone:hover, .form-dropzone:focus-visible, .form-dropzone-active { border-color: var(--green-700, #1f6b4a); background: #f2f8f4; box-shadow: 0 0 0 3px rgba(31, 107, 74, 0.12); outline: none; }
	.form-dropzone:disabled { cursor: not-allowed; opacity: 0.6; }
	.form-file-row { display: flex; min-width: 0; align-items: center; gap: 10px; border: 1px solid var(--line); border-radius: 12px; background: #fff; padding: 8px; }
	.form-file-thumb { display: flex; width: 48px; height: 60px; flex: 0 0 48px; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; background: #f8faf8; }
	.form-page-badge, .form-file-status { flex: 0 0 auto; border-radius: 999px; background: #f1f5f2; padding: 2px 7px; color: #526158; font-size: 10px; font-weight: 600; }
	.form-file-new { background: #edf7f0; color: #236746; }
	.form-file-action { display: flex; width: 36px; height: 36px; flex: 0 0 36px; align-items: center; justify-content: center; border-radius: 8px; color: #536159; transition: background 150ms, color 150ms; }
	.form-file-action:hover:not(:disabled) { background: #f0f4f1; color: #1f6b4a; }
	.form-file-action:focus-visible { outline: 2px solid #1f6b4a; outline-offset: 1px; }
	.form-file-action:disabled { cursor: not-allowed; opacity: 0.35; }
	.form-file-remove:hover:not(:disabled) { background: #fef0ef; color: #b42318; }
	:global(.ui-modal-panel:has(.form-editor-body)) { width: min(640px, 94vw); max-width: none; max-height: 90vh; border-radius: 16px; }
	:global(.ui-modal-panel:has(.form-editor-body) > div:first-child) { position: sticky; top: 0; z-index: 2; min-height: 92px; align-items: flex-start; padding: 18px 24px 42px; background: #fff; border-radius: 16px 16px 0 0; }
	:global(.ui-modal-panel:has(.form-editor-body) > div:first-child::after) { position: absolute; top: 48px; left: 24px; color: #718078; font-size: 12px; content: 'Fill in the details and upload the form files.'; }
	:global(.ui-modal-panel:has(.editor-editing) > div:first-child::after) { content: 'Update the details and files for this form.'; }
	:global(.ui-modal-panel:has(.form-editor-body) > div:first-child button:focus-visible) { outline: 2px solid #1f6b4a; outline-offset: 2px; }
	:global(.ui-modal-panel:has(.form-editor-body) > div:nth-child(2)) { overscroll-behavior: contain; padding: 20px 24px; }
	:global(.ui-modal-panel:has(.form-editor-body) > div:last-child) { position: sticky; bottom: 0; z-index: 2; background: #fff; border-radius: 0 0 16px 16px; }
	@media (max-width: 599px) {
		:global(.ui-modal-backdrop:has(.form-editor-body)) { align-items: flex-end; padding: 0; }
		:global(.ui-modal-panel:has(.form-editor-body)) { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 16px 16px 0 0; }
		:global(.ui-modal-panel:has(.form-editor-body) > div:first-child) { border-radius: 16px 16px 0 0; padding-right: 18px; padding-left: 18px; }
		:global(.ui-modal-panel:has(.form-editor-body) > div:first-child::after) { left: 18px; }
		:global(.ui-modal-panel:has(.form-editor-body) > div:nth-child(2)) { padding-right: 18px; padding-left: 18px; }
		.form-file-row { flex-wrap: wrap; }
		.form-file-row > :global(.form-file-action) { width: 36px; height: 36px; }
	}
</style>
