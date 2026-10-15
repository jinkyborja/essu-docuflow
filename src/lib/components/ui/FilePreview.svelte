<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import LoadingState from './LoadingState.svelte';
	import LoadError from './LoadError.svelte';
	import PdfDocumentViewer from '$lib/components/forms/PdfDocumentViewer.svelte';
	import { studentFileUrl, downloadStudentFile } from '$lib/student-files';
	import { showToast } from '$lib/stores/toasts';
	let { open, path, name, onclose, bucket = 'requirements' }: { open: boolean; path: string; name: string; onclose: () => void; bucket?: 'requirements' | 'templates' } = $props();
	let previewUrl = $state(''), error = $state(''), kind = $state('');
	let pdfFile = $state<Blob | null>(null);
	let loading = $state(false), downloading = $state(false), attempt = $state(0);
	async function getFileUrl(filePath: string, signal?: AbortSignal) {
		if (bucket === 'requirements') return studentFileUrl(filePath);
		const response = await fetch('/api/storage?bucket=templates&path=' + encodeURIComponent(filePath), { signal });
		const result = await response.json();
		if (!response.ok || !result.url) throw new Error(result.error ?? 'Could not open this file. Please try again.');
		return result.url as string;
	}
	$effect(() => {
		if (!open) return;
		const filePath = path;
		void attempt;
		let active = true, objectUrl = '';
		const controller = new AbortController();
		loading = true; error = ''; previewUrl = ''; kind = ''; pdfFile = null;
		void (async () => {
			try {
				if (!filePath) throw new Error('This document is not available yet.');
				const signedUrl = await getFileUrl(filePath, controller.signal);
				const response = await fetch(signedUrl, { signal: controller.signal });
				if (!response.ok) throw new Error('The document could not be loaded. Please try again.');
				const blob = await response.blob();
				if (!blob.size) throw new Error('This document is empty or unavailable.');
				const signature = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
				const type = signature === '%PDF-' ? 'application/pdf' : blob.type;
				if (type !== 'application/pdf' && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) throw new Error('A preview is not available for this file format. You can still download the document.');
				if (!active) return;
				if (type === 'application/pdf') {
					kind = 'pdf';
					pdfFile = blob;
				} else {
					objectUrl = URL.createObjectURL(new Blob([blob], { type }));
					kind = 'image';
					previewUrl = objectUrl;
				}
			} catch (problem) { if (active) error = problem instanceof Error ? problem.message : 'Could not load this document.'; }
			finally { if (active) loading = false; }
		})();
		return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
	});
	async function download() {
		if (downloading || !path) return;
		downloading = true;
		try { await downloadStudentFile(await getFileUrl(path), name); }
		catch (problem) { showToast(problem instanceof Error ? problem.message : 'Could not download this document.', 'error'); }
		finally { downloading = false; }
	}
</script>

<Modal {open} title={name || 'Document preview'} size="xl" {onclose}>
	{#snippet body()}
		<div class="file-preview" aria-busy={loading}>
			{#if loading}<LoadingState label="Loading document preview…" />
			{:else if error}<LoadError message={error} onretry={() => attempt++} />
			{:else if pdfFile && kind === 'pdf'}<PdfDocumentViewer file={pdfFile} />
			{:else if previewUrl}<img src={previewUrl} alt={name} onerror={() => error = 'The image preview could not load.'} />{/if}
		</div>
	{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={onclose}>Close</Button><Button icon="fa-solid fa-download" loading={downloading} disabled={!path} onclick={download}>Download</Button>{/snippet}
</Modal>

<style>
	.file-preview { min-height: min(18rem, 50dvh); min-width: 0; }
	:global(.file-preview .pdf-viewer) { width: 100%; height: min(65vh, 65dvh); border: 1px solid var(--color-border); border-radius: var(--radius-control); }
	img { display: block; max-width: 100%; max-height: 65dvh; margin-inline: auto; object-fit: contain; }
</style>
