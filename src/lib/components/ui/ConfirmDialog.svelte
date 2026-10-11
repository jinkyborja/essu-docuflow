<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import TextArea from './TextArea.svelte';
	import TextField from './TextField.svelte';
	import { validateForm } from './form-validation';
	import type { Snippet } from 'svelte';
	let { open, title, message, requireReason = false, requiredText = '', minLength = 10, confirmLabel = 'Confirm', cancelLabel = 'Cancel', loading = false, disabled = false, disabledReason, error = '', details, variant = 'danger', onclose, onconfirm }: { open: boolean; title: string; message: string; requireReason?: boolean; requiredText?: string; minLength?: number; confirmLabel?: string; cancelLabel?: string; loading?: boolean; disabled?: boolean; disabledReason?: string; error?: string; details?: Snippet; variant?: 'primary' | 'danger'; onclose: () => void; onconfirm: (reason: string) => void | Promise<void> } = $props();
	let reason = $state(''), typed = $state('');
	let confirming = $state(false);
	let confirmError = $state('');
	const busy = $derived(loading || confirming);
	const id = $props.id();
	$effect(() => { if (open) { reason = ''; typed = ''; confirmError = ''; } });
	function close() { if (!busy) onclose(); }
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy || disabled || (requireReason && reason.trim().length < minLength) || (requiredText && typed !== requiredText)) return;
		confirming = true; confirmError = '';
		try { await onconfirm(reason.trim()); }
		catch (failure) { confirmError = failure instanceof Error ? failure.message : 'Could not complete this action. Please try again.'; }
		finally { confirming = false; }
	}
</script>
<Modal {open} {title} size="sm" onclose={close} closeDisabled={busy} descriptionId={id + '-message'} trackDirty={false}>
	{#snippet body()}<form use:validateForm id={id} onsubmit={submit} class="confirm-form"><p id={id + '-message'}>{message}</p>{#if details}{@render details()}{/if}{#if requireReason}<TextArea label="Reason" bind:value={reason} required minlength={minLength} maxlength={300} disabled={busy} helper={'At least ' + minLength + ' characters.'} />{/if}{#if requiredText}<TextField label={'Type ' + requiredText + ' to confirm'} bind:value={typed} required disabled={busy} helper="This action cannot be undone." />{/if}{#if error || confirmError}<p role="alert" class="confirm-error">{error || confirmError}</p>{/if}</form>{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={close} disabled={busy}>{cancelLabel}</Button><Button {variant} type="submit" form={id} loading={busy} disabled={disabled || (requireReason && reason.trim().length < minLength) || (!!requiredText && typed !== requiredText)} disabledReason={disabled ? disabledReason : requiredText ? 'Type ' + requiredText + ' to confirm.' : requireReason ? `Enter a reason of at least ${minLength} characters.` : undefined}>{confirmLabel}</Button>{/snippet}
</Modal>
<style>
	.confirm-form { display: grid; gap: var(--space-4); color: var(--color-text); font-size: var(--type-body); line-height: var(--line-height); }
	p { margin: 0; }
	.confirm-error { color: var(--color-danger); }
</style>
