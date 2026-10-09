<script lang="ts">
	import { untrack } from 'svelte';
	import Modal from './Modal.svelte';
	import type { MasterlistRow } from '$lib/server/masterlist';
	let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();
	let rows = $state<MasterlistRow[]>([]), search = $state(''), page = $state(1), total = $state(0);
	let busy = $state(false), loading = $state(false), error = $state(''), file = $state<File | null>(null);
	let summary = $state<{added: number; updated: number; skipped: number; reasons: Array<{row: number; reason: string}>} | null>(null);
	let listVersion = 0;
	async function loadRows(next = page) {
		const version = ++listVersion;
		page = next; loading = true; error = '';
		try {
			const res = await fetch('/api/masterlist?' + new URLSearchParams({search, page: String(next)}));
			const data = await res.json();
			if (version !== listVersion) return;
			if (!res.ok) { error = data.error ?? data.message ?? 'Could not load masterlist.'; return; }
			rows = data.rows; total = data.total;
		} catch { if (version === listVersion) error = 'Could not load masterlist.'; }
		finally { if (version === listVersion) loading = false; }
	}
	$effect(() => { if (open) { search = ''; summary = null; file = null; untrack(() => { void loadRows(1); }); } });
	function chooseFile(candidate: File | null) {
		error = ''; summary = null;
		if (candidate && candidate.size > 2 * 1024 * 1024) { error = 'CSV must be at most 2 MB.'; file = null; return; }
		file = candidate;
	}
	async function importFile() {
		if (!file) return;
		busy = true; error = '';
		try {
			const data = new FormData(); data.append('file', file);
			const res = await fetch('/api/masterlist/import', {method: 'POST', body: data});
			const result = await res.json();
			if (!res.ok) { error = result.error ?? result.message ?? 'Import failed.'; return; }
			summary = result; file = null; await loadRows(1);
		} catch { error = 'Import failed. Please try again.'; } finally { busy = false; }
	}
	async function remove(row: MasterlistRow) {
		if (!confirm('Delete masterlist entry for ' + row.student_id + '?')) return;
		busy = true; error = '';
		try {
			const res = await fetch('/api/masterlist/' + row.id, {method: 'DELETE'});
			if (!res.ok) { const result = await res.json(); error = result.error ?? result.message ?? 'Delete failed.'; return; }
			await loadRows(rows.length === 1 && page > 1 ? page - 1 : page);
		} catch { error = 'Delete failed.'; } finally { busy = false; }
	}
	const template = 'data:text/csv;charset=utf-8,' + encodeURIComponent('student_id,last_name,first_name,middle_name,program,campus,status,school_year\r\n26-0001,Dela Cruz,Juan,,Master of Information Technology,Guiuan,Enrolled,2026-2027\r\n');
</script>
<Modal {open} title="Graduate School enrollment masterlist" size="lg" {onclose}>
	{#snippet body()}
		<div class="space-y-4">
			<p class="text-xs text-gray-600">Include historical enrollment records for Former students and Alumni. The masterlist supports one record per student ID; importing that ID again updates its record.</p>
			<a href={template} download="enrollment-masterlist-template.csv" class="text-sm text-essu-green underline focus:outline-none focus:ring-2 focus:ring-essu-green/30">Download CSV template</a>
			<div role="region" aria-label="CSV upload" ondragover={e => e.preventDefault()} ondrop={e => { e.preventDefault(); if (!busy) chooseFile(e.dataTransfer?.files[0] ?? null); }} class="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
				<label class="block text-sm text-gray-600">Drop a CSV here or choose a file (maximum 2 MB)
					<input type="file" accept=".csv,text/csv" disabled={busy} onchange={e => chooseFile(e.currentTarget.files?.[0] ?? null)} class="mt-2 block w-full text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
				</label>
				{#if file}<p class="mt-2 text-xs text-gray-600">Selected: {file.name}</p>{/if}
				<button onclick={importFile} disabled={!file || busy} class="mt-3 px-4 py-2 bg-essu-green text-white text-sm rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30">{busy ? 'Working...' : 'Import CSV'}</button>
			</div>
			{#if summary}
				<div role="status" class="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">Added: {summary.added}. Updated: {summary.updated}. Skipped: {summary.skipped}.</div>
				{#if summary.reasons.length}<details class="text-xs text-gray-600"><summary>Skipped rows and reasons</summary><ul class="mt-2 max-h-40 overflow-auto">{#each summary.reasons as reason}<li>Row {reason.row}: {reason.reason}</li>{/each}</ul></details>{/if}
			{/if}
			{#if error}<p role="alert" class="text-sm text-red-700">{error}</p>{/if}
			<form onsubmit={e => { e.preventDefault(); void loadRows(1); }} class="flex gap-2">
				<input aria-label="Search masterlist" bind:value={search} placeholder="Search ID, name, program or campus" class="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" />
				<button disabled={busy || loading} class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-essu-green focus:outline-none focus:ring-2 focus:ring-essu-green/30">Search</button>
			</form>
			<div class="overflow-x-auto border border-gray-100 rounded-lg">
				<table class="w-full text-xs text-left"><thead class="bg-gray-50"><tr>{#each ['Student ID','Name','Program','Campus','Status','School year','Action'] as label}<th class="p-2">{label}</th>{/each}</tr></thead>
					<tbody>{#each rows as row}<tr class="border-t border-gray-100"><td class="p-2 font-mono">{row.student_id}</td><td class="p-2">{row.last_name}, {row.first_name} {row.middle_name ?? ''}</td><td class="p-2">{row.program}</td><td class="p-2">{row.campus ?? '-'}</td><td class="p-2">{row.status ?? '-'}</td><td class="p-2">{row.school_year ?? '-'}</td><td class="p-2"><button onclick={() => remove(row)} disabled={busy || loading} class="text-red-600 focus:outline-none focus:ring-2 focus:ring-essu-green/30" aria-label={'Delete ' + row.student_id}>Delete</button></td></tr>{/each}</tbody>
				</table>
				{#if !rows.length}<p class="p-4 text-sm text-gray-500">{loading ? 'Loading...' : 'No entries found.'}</p>{/if}
			</div>
			<div class="flex justify-between items-center text-xs text-gray-500"><button onclick={() => loadRows(page - 1)} disabled={page <= 1 || busy || loading} class="border rounded-lg px-3 py-2 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-essu-green/30">Previous</button><span>Page {page} / {Math.max(1, Math.ceil(total / 20))} ({total} entries)</span><button onclick={() => loadRows(page + 1)} disabled={page * 20 >= total || busy || loading} class="border rounded-lg px-3 py-2 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-essu-green/30">Next</button></div>
		</div>
	{/snippet}
	{#snippet footer()}<button onclick={onclose} class="px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-essu-green/30">Close</button>{/snippet}
</Modal>
