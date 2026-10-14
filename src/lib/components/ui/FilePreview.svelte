<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import LoadingState from './LoadingState.svelte';
	import LoadError from './LoadError.svelte';
	import { studentFileUrl, downloadStudentFile } from '$lib/student-files';
	import { showToast } from '$lib/stores/toasts';
	let { open, path, name, onclose }: { open: boolean; path: string; name: string; onclose: () => void } = $props();
	let previewUrl = $state(''), error = $state(''), kind = $state('');
	let loading = $state(false), downloading = $state(false), attempt = $state(0);
	$effect(() => {
		if (!open) return;
		const filePath = path;
		void attempt;
		let active = true, objectUrl = '';
		const controller = new AbortController();
		loading = true; error = ''; previewUrl = ''; kind = '';
		void (async () => {
			try {
				if (!filePath) throw new Error('This document is not available yet.');
				const signedUrl = await studentFileUrl(filePath);
				const response = await fetch(signedUrl, { signal: controller.signal });
				if (!response.ok) throw new Error('The document could not be loaded. Please try again.');
				const blob = await response.blob();
				if (!blob.size) throw new Error('This document is empty or unavailable.');
				const signature = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
				const type = signature === '%PDF-' ? 'application/pdf' : blob.type;
				if (type !== 'application/pdf' && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) throw new Error('A preview is not available for this file format. You can still download the document.');
				if (!active) return;
				objectUrl = URL.createObjectURL(new Blob([blob], { type }));
				kind = type === 'application/pdf' ? 'pdf' : 'image'; previewUrl = objectUrl;
			} catch (problem) { if (active) error = problem instanceof Error ? problem.message : 'Could not load this document.'; }
			finally { if (active) loading = false; }
		})();
		return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
	});
	async function download() {
		if (downloading || !path) return;
		downloading = true;
		try { await downloadStudentFile(await studentFileUrl(path), name); }
		catch (problem) { showToast(problem instanceof Error ? problem.message : 'Could not download this document.', 'error'); }
		finally { downloading = false; }
	}
</script>

<Modal {open} title={name || 'Document preview'} size="xl" {onclose}>
	{#snippet body()}
		<div class="file-preview" aria-busy={loading}>
			{#if loading}<LoadingState label="Loading document preview…" />
			{:else if error}<LoadError message={error} onretry={() => attempt++} />
			{:else if previewUrl && kind === 'pdf'}<iframe src={previewUrl} title={name || 'Document preview'} onerror={() => error = 'The PDF viewer could not load. Try again or download the document.'}></iframe>
			{:else if previewUrl}<img src={previewUrl} alt={name} onerror={() => error = 'The image preview could not load.'} />{/if}
		</div>
	{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={onclose}>Close</Button><Button icon="fa-solid fa-download" loading={downloading} disabled={!path} onclick={download}>Download</Button>{/snippet}
</Modal>

<style>
	.file-preview { min-height: min(18rem, 50dvh); }
	iframe { display: block; width: 100%; height: 65vh; height: 65dvh; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-bg); }
	img { display: block; max-width: 100%; max-height: 65dvh; margin-inline: auto; object-fit: contain; }
</style>
