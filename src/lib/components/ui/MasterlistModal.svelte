<script lang="ts">
	import { responsiveTable } from '$lib/responsive-table';
	import { formatName } from '$lib/formatting';
	import { untrack } from 'svelte';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import RowMenu from './RowMenu.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import FileDrop from '$lib/components/forms/FileDrop.svelte';
	import LoadingState from './LoadingState.svelte';
	import LoadError from './LoadError.svelte';
	import { showToast } from '$lib/stores/toasts';
	import type { MasterlistRow } from '$lib/server/masterlist';
	let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();
	let rows = $state<MasterlistRow[]>([]), search = $state(''), page = $state(1), total = $state(0);
	let busy = $state(false), loading = $state(false), error = $state(''), file = $state<File | null>(null);
	let clearing = $state(false), message = $state(''), loadError = $state('');
	let uploadFiles = $state<File[]>([]);
	let deletion = $state<'all' | MasterlistRow | null>(null);
	function requestDelete(target: 'all' | MasterlistRow) { if (!busy && !loading) { deletion = target; error = ''; } }
	function cancelDelete() { if (!busy) deletion = null; }
	async function confirmDelete() { if (deletion === 'all') await removeAll(); else if (deletion) await remove(deletion); }
	let summary = $state<{added: number; updated: number; skipped: number; reasons: Array<{row: number; reason: string}>} | null>(null);
	let listVersion = 0;
	async function loadRows(next = page) {
		const version = ++listVersion;
		page = next; loading = true; error = ''; loadError = '';
		try {
			const res = await fetch('/api/masterlist?' + new URLSearchParams({search, page: String(next)}));
			const data = await res.json();
			if (version !== listVersion) return;
			if (!res.ok) { loadError = data.error ?? data.message ?? 'Could not load masterlist.'; showToast(loadError, 'error'); return; }
			if (!Array.isArray(data.rows) || !Number.isFinite(Number(data.total))) throw new Error('Invalid masterlist response');
			rows = data.rows; total = data.total;
		} catch { if (version === listVersion) { loadError = 'Could not load masterlist.'; showToast(loadError, 'error'); } }
		finally { if (version === listVersion) loading = false; }
	}
	$effect(() => { if (open) { search = ''; summary = null; file = null; message = ''; untrack(() => { void loadRows(1); }); } });
	function close() {
		if (busy) return;
		++listVersion; loading = false;
		onclose();
	}
	function chooseFile(candidate: File | null) {
		if (busy) return;
		error = ''; summary = null; message = '';
		if (candidate && candidate.size > 2 * 1024 * 1024) { error = 'CSV must be at most 2 MB.'; file = null; uploadFiles = []; return; }
		file = candidate; uploadFiles = candidate ? [candidate] : [];
	}
	async function importFile() {
		if (!file || busy || loading) return;
		busy = true; error = ''; message = '';
		try {
			const data = new FormData(); data.append('file', file);
			const res = await fetch('/api/masterlist/import', {method: 'POST', body: data});
			const result = await res.json();
			if (!res.ok) { error = result.error ?? result.message ?? 'Import failed.'; showToast(error, 'error'); return; }
			summary = result; file = null; uploadFiles = []; showToast('Masterlist import complete. Added: ' + result.added + '. Updated: ' + result.updated + '. Skipped: ' + result.skipped + '.'); await loadRows(1);
		} catch { error = 'Import failed. Please try again.'; showToast(error, 'error'); } finally { busy = false; }
	}
	async function remove(row: MasterlistRow) {
		if (busy || loading) return;
		if (deletion !== row) return;
		busy = true; error = ''; message = '';
		try {
			const res = await fetch('/api/masterlist/' + row.id, {method: 'DELETE'});
			if (!res.ok) { const result = await res.json(); error = result.error ?? result.message ?? 'Delete failed.'; showToast(error, 'error'); return; }
			deletion = null; showToast('Masterlist entry deleted.'); await loadRows(rows.length === 1 && page > 1 ? page - 1 : page);
		} catch { error = 'Delete failed.'; showToast(error, 'error'); } finally { busy = false; }
	}
	async function removeAll() {
		if (busy || loading) return;
		if (deletion !== 'all') return;
		busy = true; clearing = true; error = ''; message = ''; ++listVersion;
		try {
			const res = await fetch('/api/masterlist', {method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({confirm: true})});
			const result = await res.json();
			if (!res.ok) { error = result.error ?? result.message ?? 'Could not delete masterlist entries.'; showToast(error, 'error'); return; }
			rows = []; total = 0; search = ''; page = 1; file = null; uploadFiles = []; summary = null;
			message = result.deleted === 0 ? 'The masterlist is already empty.' : `${result.deleted} masterlist ${result.deleted === 1 ? 'entry' : 'entries'} deleted.`;
			deletion = null; showToast(message); await loadRows(1);
		} catch { error = 'Could not delete masterlist entries. Please try again.'; showToast(error, 'error'); }
		finally { busy = false; clearing = false; }
	}
	const template = 'data:text/csv;charset=utf-8,' + encodeURIComponent('student_id,last_name,first_name,middle_name,program,campus,status,school_year\r\n26-0001,Dela Cruz,Juan,,Master of Information Technology,Guiuan,Enrolled,2026-2027\r\n');
</script>
<Modal {open} title="Graduate School enrollment masterlist" size="lg" onclose={close}>
	{#snippet headerActions()}<RowMenu label="Masterlist actions" items={[{label: 'Clear enrollment masterlist', danger: true, onselect: () => requestDelete('all')}]} />{/snippet}
	{#snippet body()}
		<div class="space-y-4">
			<p class="text-xs text-gray-600">Include historical enrollment records for Former students and Alumni. The masterlist supports one record per student ID; importing that ID again updates its record.</p>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<a href={template} download="enrollment-masterlist-template.csv" class="text-sm text-essu-green underline focus:outline-none focus:ring-2 focus:ring-essu-green/30">Download CSV template</a>
			</div>
			<div>
				<FileDrop label="CSV import" bind:files={uploadFiles} accept=".csv,text/csv" maxBytes={2 * 1024 * 1024} helper="Drop a CSV here or browse. Maximum 2 MB." onchange={(files) => chooseFile(files[0] ?? null)} />
				<Button onclick={() => void importFile()} disabled={!file || busy || loading} loading={busy && !deletion}>Import CSV</Button>
			</div>
			{#if summary}
				<div role="status" class="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">Added: {summary.added}. Updated: {summary.updated}. Skipped: {summary.skipped}.</div>
				{#if summary.reasons.length}<details class="text-xs text-gray-600"><summary>Skipped rows and reasons</summary><ul class="mt-2 max-h-40 overflow-auto">{#each summary.reasons as reason}<li>Row {reason.row}: {reason.reason}</li>{/each}</ul></details>{/if}
			{/if}
			{#if message}<p role="status" class="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">{message}</p>{/if}
			{#if error}<p role="alert" class="text-sm text-red-700">{error}</p>{/if}
			<form onsubmit={e => { e.preventDefault(); if (!busy && !loading) void loadRows(1); }} class="flex gap-2">
				<input aria-label="Search masterlist" bind:value={search} disabled={busy} placeholder="Search ID, name, program or campus" class="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
				<button disabled={busy || loading} class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-essu-green focus:outline-none focus:ring-2 focus:ring-essu-green/30">Search</button>
			</form>
			{#if loading}<LoadingState label="Loading masterlist…" />{:else if loadError}<LoadError message="We couldn’t load the masterlist. Please try again." onretry={() => void loadRows()} />{:else}<div class="overflow-x-auto border border-gray-100 rounded-lg">
				<table use:responsiveTable class="responsive-table w-full text-xs text-left"><thead class="bg-gray-50"><tr>{#each ['Student ID','Name','Program','Campus','Status','School year','Action'] as label}<th class="p-2">{label}</th>{/each}</tr></thead>
					<tbody>{#each rows as row}<tr class="border-t border-gray-100"><td class="p-2 font-mono">{row.student_id}</td><td class="p-2">{formatName(row.first_name, row.middle_name, row.last_name)}</td><td class="p-2">{row.program}</td><td class="p-2">{row.campus ?? '-'}</td><td class="p-2">{row.status ?? '-'}</td><td class="p-2">{row.school_year ?? '-'}</td><td class="p-2"><button onclick={() => requestDelete(row)} disabled={busy || loading} class="text-red-600 focus:outline-none focus:ring-2 focus:ring-essu-green/30" aria-label={'Delete ' + row.student_id}>Delete</button></td></tr>{/each}</tbody>
				</table>
				<div class="space-y-3 p-4 text-sm text-gray-600">{#if !rows.length}<p>No entries found. {search ? 'Clear your search to see all entries.' : 'Import a CSV to add students.'}</p>{#if search}<Button variant="secondary" onclick={() => { search = ''; void loadRows(1); }}>Clear search</Button>{:else}<Button variant="secondary" href={template}>Download CSV template</Button>{/if}{/if}</div>
			</div>
			{/if}<div class="flex flex-wrap justify-between items-center gap-3 text-xs text-gray-500"><button onclick={() => loadRows(page - 1)} disabled={page <= 1 || busy || loading} class="border rounded-lg px-3 py-2 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-essu-green/30">Previous</button><span>Page {page} / {Math.max(1, Math.ceil(total / 20))} ({total} entries)</span><button onclick={() => loadRows(page + 1)} disabled={page * 20 >= total || busy || loading} class="border rounded-lg px-3 py-2 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-essu-green/30">Next</button></div>
		</div>
	{/snippet}
	{#snippet footer()}<button onclick={close} disabled={busy} class="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30">Close</button>{/snippet}
</Modal>

<ConfirmDialog open={!!deletion} title={deletion === 'all' ? 'Clear enrollment masterlist' : 'Delete masterlist entry'} message={deletion === 'all' ? 'Permanently delete every enrollment masterlist entry across all pages, including entries hidden by your search. Student accounts and existing verification decisions are kept.' : 'Delete the masterlist entry for ' + (deletion?.student_id ?? '') + '?'} confirmLabel={deletion === 'all' ? 'Clear masterlist' : 'Delete entry'} requirePhrase={deletion === 'all' ? 'CLEAR' : ''} loading={busy} {error} onclose={cancelDelete} onconfirm={confirmDelete} />
