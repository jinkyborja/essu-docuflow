<script lang="ts">
 import FileDrop from './FileDrop.svelte';
 import Button from './Button.svelte';
 import StatusChip from './StatusChip.svelte';
 import { validateRequirementFileMetadata } from '$lib/requirement-files';
 import { showToast } from '$lib/stores/toasts';
 let { name, file, disabled = false, onchange }: { name: string; file: File | null; disabled?: boolean; onchange: (file: File | null) => void } = $props();
 let picker: FileDrop, error = $state('');
 function choose(selected: File | null) { error = selected ? validateRequirementFileMetadata(selected.name, selected.type, selected.size) ?? '' : ''; if(error){showToast(name+': '+error,'error');return;} onchange(selected); }
</script>
<div class="space-y-3"><FileDrop bind:this={picker} label={'Upload '+name} {file} {disabled} {error} accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*" helper="PDF or image · up to 10 MB" onchange={choose}/><div class="flex flex-wrap items-center justify-between gap-3"><StatusChip kind="file" value={file ? 'uploaded' : 'missing'}/>{#if file}<Button variant="ghost" {disabled} icon="fa-solid fa-arrow-rotate-left" onclick={()=>picker.browse()}>Replace file</Button>{/if}</div></div>
