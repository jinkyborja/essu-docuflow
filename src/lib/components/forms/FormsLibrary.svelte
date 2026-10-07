<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { formCategories, type FormRecord, type FormFile } from '$lib/data/forms';
	let forms = $state<FormRecord[]>([]);
	let loading = $state(true);
	let { canManage }: { canManage: boolean } = $props();
	let query = $state(''); let category = $state('All categories');
	let modalOpen = $state(false); let deleteOpen = $state(false); let viewOpen = $state(false);
	let editing = $state<FormRecord | null>(null); let selected = $state<FormRecord | null>(null);
	let deleting = $state<FormRecord | null>(null); let saving = $state(false); let progress = $state(0);
	let toastMessage = $state(''); let toastError = $state(false); let searchField = $state('');
	let downloadFor = $state<number | null>(null);
	let title = $state(''); let categoryValue = $state(''); let newCategory = $state(''); let code = $state(''); let description = $state('');
	let fields = $state<string[]>([]); let fieldDraft = $state(''); let downloadName = $state('');
	type DraftFile = { file?: File; page_no: number; storage_path: string | null; public_url: string; name: string; type: string; preview?: string };
	let draftFiles = $state<DraftFile[]>([]); let inlineError = $state(''); let fileInput = $state<HTMLInputElement>();
	const categories = $derived(['All categories', ...new Set([...formCategories, ...forms.map((f) => f.category)])]);
	const filtered = $derived(forms.filter((f) => (category === 'All categories' || f.category === category) && `${f.title} ${f.category} ${f.code ?? ''}`.toLowerCase().includes(query.toLowerCase())));
	onMount(() => { void refresh(); });
	async function refresh() {
		loading = true;
		try { const response = await fetch('/api/forms'); if (!response.ok) throw new Error((await response.json()).error || 'Could not load forms.'); forms = await response.json(); }
		catch (e) { toast((e as Error).message, true); } finally { loading = false; }
	}
	function toast(message: string, error = false) { toastMessage = message; toastError = error; setTimeout(() => toastMessage = '', 4000); }
	function slug(value: string) { return `ESSU-${value.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').toLowerCase() || 'form'}`; }
	function openEditor(form?: FormRecord) {
		editing = form ?? null; title = form?.title ?? ''; categoryValue = form?.category ?? ''; newCategory = ''; code = form?.code ?? ''; description = form?.description ?? ''; fields = [...(form?.fields ?? [])]; downloadName = form?.download_name ?? ''; fieldDraft = ''; inlineError = '';
		draftFiles = form ? form.files.map((f) => ({ ...f, name: f.public_url.split('/').pop() || `Page ${f.page_no}`, type: f.public_url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' })) : [];
		modalOpen = true;
	}
	function addField(event: KeyboardEvent) { if (event.key === 'Enter') { event.preventDefault(); const value = fieldDraft.trim(); if (value && value.length <= 80 && fields.length < 30 && !fields.includes(value)) fields = [...fields, value]; fieldDraft = ''; } }
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
		const realCategory = categoryValue === '__new' ? newCategory.trim() : categoryValue.trim();
		if (!title.trim() || !realCategory || description.length > 4000 || !draftFiles.length) { inlineError = 'Enter a title and category, keep the description under 4,000 characters, and add at least one file.'; return; }
		saving = true; progress = 0; inlineError = '';
		try {
			const nextFiles: (FormFile & { name?: string; type?: string })[] = draftFiles.map((f) => ({ page_no: f.page_no, storage_path: f.storage_path, public_url: f.public_url, name: f.name, type: f.type }));
			const newOnes = draftFiles.filter((f) => f.file);
			if (newOnes.length) {
				const urlResponse = await fetch('/api/forms/upload-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files: newOnes.map((f) => ({ name: f.file!.name, type: f.file!.type, size: f.file!.size })) }) });
				const result = await urlResponse.json(); if (!urlResponse.ok) throw new Error(result.error || 'Could not prepare file upload.');
				for (let i = 0; i < newOnes.length; i++) {
					const target = nextFiles.find((f) => f.name === newOnes[i].name && !f.storage_path && !f.public_url);
					const upload = result.uploads[i]; const response = await fetch(upload.signedUrl, { method: 'PUT', headers: { 'content-type': upload.type }, body: newOnes[i].file });
					if (!response.ok) throw new Error(`Upload failed for ${upload.name}.`);
					if (target) { target.storage_path = upload.path; target.public_url = upload.publicUrl; }
					progress = Math.round(((i + 1) / newOnes.length) * 100);
				}
			}
			const body = { title, category: realCategory, code: code.trim() || null, description, fields, download_name: downloadName.trim() || slug(title), files: nextFiles.map((f, i) => ({ page_no: i + 1, storage_path: f.storage_path, public_url: f.public_url })) };
			const response = await fetch(editing ? `/api/forms/${editing.form_id}` : '/api/forms', { method: editing ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
			const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save form.');
			modalOpen = false; toast(editing ? 'Form updated.' : 'Form added.'); await refresh();
		} catch (e) { inlineError = (e as Error).message; } finally { saving = false; }
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
		if (event.key !== 'Tab' || !(modalOpen || deleteOpen || viewOpen)) return;
		const dialog = document.querySelector('[role="dialog"]');
		const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
		if (!focusable?.length) return;
		const first = focusable[0], last = focusable[focusable.length - 1];
		if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
		else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
	}
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
		<article class="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"><div class="flex items-start justify-between gap-3"><div class="flex min-w-0 items-start gap-3"><button class="relative h-[72px] w-14 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => { selected = form; viewOpen = true; }} aria-label={`View ${form.title}`}>
			{#if form.files[0]?.public_url.toLowerCase().endsWith('.pdf')}<span class="flex h-full items-center justify-center text-2xl text-gray-400"><i class="fa-solid fa-file-pdf"></i></span>{:else}<img src={form.files[0]?.public_url} alt="" class="h-full w-full object-cover object-top" onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /><span class="pointer-events-none absolute inset-0 -z-0 flex items-center justify-center bg-gray-50 text-gray-400"><i class="fa-solid fa-file-lines"></i></span>{/if}</button>
			<div class="min-w-0"><h3 class="truncate font-semibold text-gray-800">{form.title}</h3><div class="mt-1 flex flex-wrap items-center gap-2"><Badge value={form.category} size="sm" />{#if form.code}<span class="text-xs text-gray-500">{form.code}</span>{/if}</div><p class="mt-2 line-clamp-2 text-sm text-gray-600">{form.description}</p><p class="mt-1 text-xs text-gray-500">{form.files.length} {form.files.length === 1 ? 'page' : 'pages'} · {form.fields?.length ?? 0} fields</p></div></div>{#if canManage}<div class="flex shrink-0 items-center gap-1"><button onclick={() => openEditor(form)} class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 transition-colors hover:text-essu-green focus:outline-none focus:ring-2 focus:ring-essu-green/30" title="Edit" aria-label={`Edit ${form.title}`}><i class="fa-solid fa-pen text-sm"></i></button><button onclick={() => { deleting = form; deleteOpen = true; }} class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-300 transition-colors hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-essu-green/30" title="Delete" aria-label={`Delete ${form.title}`}><i class="fa-solid fa-trash text-sm"></i></button></div>{/if}</div>
				<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3"><button class="flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium text-essu-green hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => { selected = form; viewOpen = true; }}><i class="fa-solid fa-eye"></i>View</button><div class="relative"><button aria-expanded={downloadFor === form.form_id} aria-label={`Download ${form.title}`} class="flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium text-essu-green hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => downloadMenu(form)}><i class="fa-solid fa-download"></i>Download</button>{#if downloadFor === form.form_id}<div class="absolute left-0 z-10 mt-1 min-w-40 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">{#each form.files as file}<button class="block w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => downloadChoice(form, file.page_no)}>Page {file.page_no}</button>{/each}<button class="block w-full rounded px-3 py-2 text-left text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30" onclick={() => downloadChoice(form, 'all')}>All pages</button></div>{/if}</div></div>
			</article>
	{/each}</div>{/if}
</div>

{#if canManage}<Modal open={modalOpen} title={editing ? 'Edit form' : 'Add form'} size="xl" onclose={() => !saving && (modalOpen = false)}>
	{#snippet body()}<form id="form-editor" class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}>
		<label class="block text-sm font-medium text-gray-700">Title <input bind:value={title} maxlength="200" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-essu-green" /></label>
		<div class="grid gap-4 sm:grid-cols-2"><label class="block text-sm font-medium text-gray-700">Category <select bind:value={categoryValue} required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-essu-green"><option value="">Choose category</option>{#each categories.filter((c) => c !== 'All categories') as item}<option value={item}>{item}</option>{/each}<option value="__new">New category...</option></select></label>{#if categoryValue === '__new'}<label class="block text-sm font-medium text-gray-700">New category <input bind:value={newCategory} maxlength="100" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-essu-green" /></label>{/if}<label class="block text-sm font-medium text-gray-700">Code <span class="font-normal text-gray-400">(optional)</span><input bind:value={code} class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-essu-green" /></label></div>
		<label class="block text-sm font-medium text-gray-700">Description <textarea bind:value={description} maxlength="4000" rows="3" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-essu-green"></textarea><span class="text-xs text-gray-500">{description.length}/4000</span></label>
		<div><label for="field-draft" class="block text-sm font-medium text-gray-700">Fields included</label><div class="mt-1 flex flex-wrap gap-2">{#each fields as field, i}<span class="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-sm text-essu-green">{field}<button type="button" aria-label={`Remove ${field}`} class="rounded-full focus:outline-none focus:ring-2 focus:ring-essu-green" onclick={() => fields = fields.filter((_, ix) => ix !== i)}>×</button></span>{/each}</div><input id="field-draft" bind:value={fieldDraft} onkeydown={addField} maxlength="80" placeholder="Type a field and press Enter" class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-essu-green" /></div>
		<label class="block text-sm font-medium text-gray-700">Download name <input bind:value={downloadName} oninput={() => { if (!downloadName) downloadName = slug(title); }} placeholder={slug(title)} class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-essu-green" /></label>
		<div role="region" aria-label="Form file uploader" ondragover={(e) => e.preventDefault()} ondrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer?.files ?? null); }} class="rounded-xl border-2 border-dashed border-gray-300 p-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-medium text-gray-800">Files (1–5, max 5 MB each)</p><p class="text-xs text-gray-500">JPG, PNG, WebP or PDF. Drag files here or browse.</p></div><Button type="button" variant="secondary" onclick={() => fileInput?.click()}>Browse files</Button><input bind:this={fileInput} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" multiple class="sr-only" onchange={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ''; }} /></div>
			<div class="mt-3 space-y-2">{#each draftFiles as file, i}<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-2"><div class="h-12 w-12 shrink-0 overflow-hidden rounded bg-white flex items-center justify-center">{#if file.type === 'application/pdf'}<i class="fa-solid fa-file-pdf text-2xl text-red-500" aria-label="PDF"></i>{:else if file.preview}<img src={file.preview} alt="" class="h-full w-full object-cover" />{:else if file.public_url.toLowerCase().endsWith('.pdf')}<i class="fa-solid fa-file-pdf text-2xl text-red-500" aria-label="PDF"></i>{:else}<img src={file.public_url} alt="" class="h-full w-full object-cover" />{/if}</div><div class="min-w-0 flex-1"><p class="truncate text-sm">Page {i + 1}: {file.name}</p><p class="text-xs text-gray-500">{file.file ? `${(file.file.size / 1024).toFixed(0)} KB · ${file.type}` : 'Existing file'}</p></div><button type="button" aria-label={`Move ${file.name} up`} class="h-11 w-11 rounded text-gray-600 focus:outline-none focus:ring-2 focus:ring-essu-green" onclick={() => moveFile(i, -1)} disabled={i === 0}><i class="fa-solid fa-arrow-up"></i></button><button type="button" aria-label={`Move ${file.name} down`} class="h-11 w-11 rounded text-gray-600 focus:outline-none focus:ring-2 focus:ring-essu-green" onclick={() => moveFile(i, 1)} disabled={i === draftFiles.length - 1}><i class="fa-solid fa-arrow-down"></i></button><button type="button" aria-label={`Remove ${file.name}`} class="h-11 w-11 rounded text-red-600 focus:outline-none focus:ring-2 focus:ring-essu-green" onclick={() => draftFiles = draftFiles.filter((_, ix) => ix !== i).map((f, ix) => ({ ...f, page_no: ix + 1 }))}><i class="fa-solid fa-xmark"></i></button></div>{/each}</div>
			{#if saving && progress > 0}<div class="mt-3"><div class="h-2 overflow-hidden rounded-full bg-gray-200"><div class="h-full bg-essu-green transition-all" style={`width:${progress}%`}></div></div><p class="mt-1 text-xs text-gray-600" aria-live="polite">Uploading {progress}%</p></div>{/if}</div>
		{#if inlineError}<p class="text-sm text-red-700" role="alert">{inlineError}</p>{/if}
	</form>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={() => modalOpen = false} disabled={saving}>Cancel</Button><Button onclick={() => void save()} loading={saving}>{editing ? 'Save changes' : 'Add form'}</Button>{/snippet}
</Modal>
<Modal open={deleteOpen} title="Delete form" onclose={() => !saving && (deleteOpen = false)}>
	{#snippet body()}<p class="text-gray-700">Delete this form? Its files will be removed. This cannot be undone.</p><p class="mt-2 font-semibold">{deleting?.title}</p>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={() => deleteOpen = false} disabled={saving}>Cancel</Button><Button variant="danger" onclick={() => void deleteForm()} loading={saving}>Delete form</Button>{/snippet}
</Modal>
{/if}
<Modal open={viewOpen} title={selected?.title ?? 'View form'} size="xl" onclose={() => viewOpen = false}>
	{#snippet body()}<div class="space-y-4">{#if selected?.description}<p class="text-gray-700">{selected.description}</p>{/if}{#each selected?.files ?? [] as file}<div><p class="mb-2 text-sm font-medium">Page {file.page_no}</p>{#if file.public_url.toLowerCase().endsWith('.pdf')}<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-6"><i class="fa-solid fa-file-pdf text-3xl text-red-500"></i><a href={file.public_url} target="_blank" rel="noopener" class="text-essu-green underline">Open PDF</a></div>{:else}<img src={file.public_url} alt={`${selected?.title} page ${file.page_no}`} class="mx-auto max-h-[65vh] rounded border border-gray-200 object-contain" />{/if}</div>{/each}{#if selected?.fields.length}<p class="text-sm text-gray-600"><strong>Fields included:</strong> {selected.fields.join(', ')}</p>{/if}</div>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={() => viewOpen = false}>Close</Button>{#if selected}{#if selected.files.length === 1}<Button onclick={() => download(selected!.files[0].public_url, selected!.download_name)} icon="fa-solid fa-download">Download</Button>{:else}<div class="flex flex-wrap gap-2">{#each selected.files as file}<Button variant="secondary" onclick={() => downloadChoice(selected!, file.page_no)}>Page {file.page_no}</Button>{/each}<Button onclick={() => downloadChoice(selected!, 'all')} icon="fa-solid fa-download">All pages</Button></div>{/if}{/if}{/snippet}
</Modal>
{#if toastMessage}<div class="fixed bottom-5 right-5 z-[70] rounded-lg px-4 py-3 text-sm text-white shadow-lg {toastError ? 'bg-red-700' : 'bg-essu-green'}" role="status" aria-live="polite">{toastMessage}</div>{/if}
