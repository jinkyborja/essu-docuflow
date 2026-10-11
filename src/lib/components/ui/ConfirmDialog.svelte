<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import type { Snippet } from 'svelte';
	let { open, title, message, requireReason = false, minLength = 10, confirmLabel = 'Confirm', cancelLabel = 'Cancel', loading = false, disabled = false, disabledReason, error = '', details, variant = 'danger', onclose, onconfirm }: { open: boolean; title: string; message: string; requireReason?: boolean; minLength?: number; confirmLabel?: string; cancelLabel?: string; loading?: boolean; disabled?: boolean; disabledReason?: string; error?: string; details?: Snippet; variant?: 'primary' | 'danger'; onclose: () => void; onconfirm: (reason: string) => void | Promise<void> } = $props();
	let reason = $state('');
	const id = $props.id();
	$effect(() => { if (open) reason = ''; });
	function close() { if (!loading) onclose(); }
	function submit(event: SubmitEvent) { event.preventDefault(); if (!loading && !disabled && (!requireReason || reason.trim().length >= minLength)) void onconfirm(reason.trim()); }
</script>
<Modal {open} {title} size="sm" onclose={close}>
	{#snippet body()}<form id={id} onsubmit={submit} class="space-y-4"><p class="text-sm text-gray-700">{message}</p>{#if details}{@render details()}{/if}{#if requireReason}<label class="block text-sm font-medium text-gray-700">Reason (required)<textarea bind:value={reason} required minlength={minLength} maxlength="300" rows="3" disabled={loading} class="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-essu-green/30" aria-describedby={id + '-hint'}></textarea><span id={id + '-hint'} class="mt-1 block text-xs font-normal text-gray-500">At least {minLength} characters.</span></label>{/if}{#if error}<p role="alert" class="text-sm text-red-700">{error}</p>{/if}</form>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={close} disabled={loading}>{cancelLabel}</Button><Button {variant} type="submit" form={id} {loading} disabled={disabled || (requireReason && reason.trim().length < minLength)} disabledReason={disabled ? disabledReason : requireReason ? `Enter a reason of at least ${minLength} characters.` : undefined}>{confirmLabel}</Button>{/snippet}
</Modal>
