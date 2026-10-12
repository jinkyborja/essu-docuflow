<script lang="ts">
	import Button from './Button.svelte';
	import StatusChip from './StatusChip.svelte';
	import { validateRequirementFileMetadata } from '$lib/requirement-files';
	import { formatFileSize } from '$lib/student-files';
	import { showToast } from '$lib/stores/toasts';
	let { name, file, disabled = false, onchange }: { name: string; file: File | null; disabled?: boolean; onchange: (file: File | null) => void } = $props();
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
	<div class="picker-row">
		<div class="file-copy">{#if file}<p class="file-name">{file.name}</p><p class="file-detail">{formatFileSize(file.size)}</p>{:else}<p class="file-detail">No file selected</p>{/if}</div>
		<label for={id} class="sr-only">Upload {name}</label>
		<input bind:this={input} {id} type="file" tabindex="-1" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*" {disabled} onchange={choose} class="sr-only" />
		<StatusChip kind="file" value={file ? 'uploaded' : 'missing'} />
		<div class="picker-actions"><Button variant={file ? 'ghost' : 'secondary'} icon="fa-solid fa-arrow-up-from-bracket" {disabled} onclick={() => input?.click()}>{file ? 'Replace' : 'Choose file'}</Button>{#if file}<Button variant="ghost" icon="fa-solid fa-xmark" {disabled} onclick={() => { error = ''; if (input) input.value = ''; onchange(null); }}>Remove</Button>{/if}</div>
	</div>
	{#if error}<p role="alert" class="file-error">{error}</p>{/if}
</div>

<style>
	.requirement-picker { display: flex; flex-direction: column; gap: var(--space-2); }
	.picker-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
	.file-copy { flex: 1 1 160px; min-width: 0; }
	p { margin: 0; line-height: var(--line-height); }
	.file-name { color: var(--color-text); font-size: var(--font-size-body); font-weight: var(--font-weight-medium); overflow-wrap: anywhere; }
	.file-detail { color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.picker-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
	.file-error { color: var(--color-danger); font-size: var(--font-size-helper); }
</style>
