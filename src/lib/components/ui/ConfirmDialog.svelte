<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import TextArea from '$lib/components/forms/TextArea.svelte';
	import TextField from '$lib/components/forms/TextField.svelte';
	import type { Snippet } from 'svelte';
	let { open, title, message, requireReason = false, requirePhrase = '', minLength = 10, confirmLabel = 'Confirm', cancelLabel = 'Cancel', loading = false, disabled = false, disabledReason, error = '', details, variant = 'danger', onclose, onconfirm }: { open: boolean; title: string; message: string; requireReason?: boolean; requirePhrase?: string; minLength?: number; confirmLabel?: string; cancelLabel?: string; loading?: boolean; disabled?: boolean; disabledReason?: string; error?: string; details?: Snippet; variant?: 'primary' | 'danger'; onclose: () => void; onconfirm: (reason: string) => void | Promise<void> } = $props();
	let reason = $state('');
	let phrase = $state('');
	const id = $props.id();
	$effect(() => { if (open) { reason = ''; phrase = ''; } });
	function close() { if (!loading) onclose(); }
	function submit(event: SubmitEvent) { event.preventDefault(); if (!loading && !disabled && (!requireReason || reason.trim().length >= minLength) && (!requirePhrase || phrase === requirePhrase)) void onconfirm(reason.trim()); }
</script>
<Modal {open} {title} size="sm" onclose={close} closeDisabled={loading} descriptionId={id + '-message'}>
	{#snippet body()}
		<form id={id} onsubmit={submit} class="confirm-form" aria-busy={loading}>
			<p id={id + '-message'}>{message}</p>
			{#if details}{@render details()}{/if}
			{#if requireReason}
				<TextArea label="Reason" bind:value={reason} required minlength={minLength} maxlength={300} rows={3} disabled={loading} helper={'At least ' + minLength + ' characters.'} />
			{/if}
			{#if requirePhrase}<TextField label={'Type ' + requirePhrase + ' to continue'} bind:value={phrase} required disabled={loading} />{/if}
			{#if error}<p role="alert" class="confirm-error">{error}</p>{/if}
		</form>
	{/snippet}
	{#snippet footer()}<Button variant="secondary" onclick={close} disabled={loading}>{cancelLabel}</Button><Button {variant} type="submit" form={id} {loading} disabled={disabled || (requireReason && reason.trim().length < minLength) || (!!requirePhrase && phrase !== requirePhrase)} disabledReason={disabled ? disabledReason : requireReason && reason.trim().length < minLength ? `Enter a reason of at least ${minLength} characters.` : requirePhrase && phrase !== requirePhrase ? `Type ${requirePhrase} to continue.` : undefined}>{confirmLabel}</Button>{/snippet}
</Modal>

<style>
	.confirm-form { display: flex; flex-direction: column; gap: var(--space-4); color: var(--color-text); font-size: var(--font-size-body); line-height: var(--line-height); }
	p { margin: 0; }
	.confirm-error { color: var(--color-danger); }
</style>
