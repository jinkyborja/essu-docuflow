<script lang="ts">
	import Button from './Button.svelte';
	import StatusChip from './StatusChip.svelte';
	import { validateRequirementFileMetadata } from '$lib/requirement-files';
	import { formatFileSize } from '$lib/student-files';
	import { showToast } from '$lib/stores/toasts';
	let { name, file, disabled = false, showStatus = true, onchange }: { name: string; file: File | null; disabled?: boolean; showStatus?: boolean; onchange: (file: File | null) => void } = $props();
	let input = $state<HTMLInputElement>();
	let error = $state('');
	const id = $props.id();
	function choose(event: Event) {
		const selected = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!selected) return;
		error = validateRequirementFileMetadata(selected.name, selected.type, selected.size) ?? '';
		if (error) { showToast(name + ': ' + error, 'error'); if (input) input.value = ''; return; }
		onchange(selected);
	}
</script>
<div class="requirement-picker">
	<div class="picker-row" class:has-file={file}>
		<div class="file-copy">
			<i class="fa-solid {file ? 'fa-file-circle-check' : 'fa-cloud-arrow-up'} file-icon" aria-hidden="true"></i>
			<div class="file-copy-text">{#if file}<p class="file-name">{file.name}</p><p class="file-detail">{formatFileSize(file.size)}</p>{:else}<p class="file-name">No file selected</p><p class="file-detail">PDF, JPG, PNG, WebP, HEIC or HEIF · Max 10 MB</p>{/if}</div>
		</div>
		<label for={id} class="sr-only">Upload {name}</label>
		<input bind:this={input} {id} type="file" tabindex="-1" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" {disabled} onchange={choose} class="sr-only" />
		{#if showStatus}<StatusChip kind="file" value={file ? 'selected' : 'missing'} size="sm" />{/if}
		<div class="picker-actions"><Button size="sm" variant="secondary" icon="fa-solid fa-arrow-up-from-bracket" {disabled} onclick={() => input?.click()}>{file ? 'Replace file' : 'Choose file'}</Button>{#if file}<Button size="sm" variant="ghost" icon="fa-solid fa-xmark" {disabled} onclick={() => { error = ''; if (input) input.value = ''; onchange(null); }}>Remove</Button>{/if}</div>
	</div>
	{#if error}<p role="alert" class="file-error">{error}</p>{/if}
</div>

<style>
	.requirement-picker { display: flex; min-width: 0; flex-direction: column; gap: var(--space-2); }
	.picker-row { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); padding: var(--space-3); border: 1px dashed var(--color-border); border-radius: var(--radius-control); background: var(--color-bg); }
	.file-copy { display: flex; min-width: 0; align-items: center; gap: var(--space-3); }
	.file-copy-text { min-width: 0; }
	.file-icon { flex: 0 0 auto; color: var(--color-primary); font-size: var(--font-size-card-title); }
	p { margin: 0; line-height: var(--line-height); }
	.file-name { color: var(--color-text); font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); overflow-wrap: anywhere; }
	.file-detail { margin-top: 2px; color: var(--color-text-muted); font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
	.picker-actions { display: flex; grid-column: 1 / -1; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); }
	.picker-actions :global(.ui-button) { min-height: 40px; }
	.file-error { color: var(--color-danger); font-size: var(--font-size-helper); }
	@media (min-width: 768px) {
		.picker-actions { grid-column: auto; }
	}
	@media (max-width: 360px) {
		.picker-row { grid-template-columns: minmax(0, 1fr); gap: var(--space-2); }
		.picker-actions { grid-column: 1; justify-content: flex-start; }
	}
</style>
