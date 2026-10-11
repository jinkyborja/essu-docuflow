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
<div class="space-y-2">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="min-w-0 flex-1">
			{#if file}<p class="break-words text-sm font-medium text-gray-800">{file.name}</p><p class="text-xs text-gray-500">{formatFileSize(file.size)}</p>{/if}
			<label for={id} class="sr-only">Upload {name}</label>
			<input bind:this={input} {id} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*" {disabled} onchange={choose} class="max-w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-essu-green/10 file:px-3 file:py-2 file:text-essu-green {file ? 'hidden' : 'block'}" />
		</div>
		<StatusChip kind="file" value={file ? 'uploaded' : 'missing'} />
		{#if file}<div class="flex items-center gap-2"><Button variant="secondary" size="sm" {disabled} onclick={() => input?.click()}>Replace</Button><Button variant="ghost" size="sm" {disabled} onclick={() => { error = ''; if (input) input.value = ''; onchange(null); }}>Remove</Button></div>{/if}
	</div>
	{#if error}<p role="alert" class="text-xs text-red-700">{error}</p>{/if}
</div>
