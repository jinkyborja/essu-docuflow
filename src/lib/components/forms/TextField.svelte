<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	const generatedId = $props.id();
	let { id = generatedId, label, value = $bindable(''), type = 'text', required = false, disabled = false, placeholder = '', helper = '', error = '', autocomplete, minlength, maxlength, min, max, pattern, oninput }: { id?: string; label: string; value?: string; type?: string; required?: boolean; disabled?: boolean; placeholder?: string; helper?: string; error?: string; autocomplete?: HTMLInputAttributes['autocomplete']; minlength?: number; maxlength?: number; min?: string; max?: string; pattern?: string; oninput?: (event: Event) => void } = $props();
	let input = $state<HTMLInputElement>(); let touched = $state(false); let nativeError = $state(''); let revealed = $state(false);
	const isPassword = $derived(type === 'password'); const visibleType = $derived(isPassword && revealed ? 'text' : type); const message = $derived(error || (touched ? nativeError : ''));
	function validate() { touched = true; nativeError = input?.validationMessage ?? ''; }
</script>
<div class="field">
	<label for={id}>{label}{#if required}<span aria-hidden="true"> *</span>{/if}</label>
	<div class="input-wrap"><input bind:this={input} {id} bind:value type={visibleType} {required} {disabled} {placeholder} {autocomplete} {minlength} {maxlength} {min} {max} {pattern} aria-invalid={!!message} aria-describedby={helper || message ? id + '-help' : undefined} onblur={validate} oninvalid={validate} {oninput} />{#if isPassword}<Button variant="ghost" type="button" icon={'fa-solid ' + (revealed ? 'fa-eye-slash' : 'fa-eye')} ariaLabel={revealed ? 'Hide password' : 'Show password'} title={revealed ? 'Hide password' : 'Show password'} onclick={() => revealed = !revealed} />{/if}</div>
	{#if message}<p id={id + '-help'} class="error" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{message}</p>{:else if helper}<p id={id + '-help'} class="helper">{helper}</p>{/if}
</div>
<style>.field{display:grid;gap:var(--space-1)}label{font-size:var(--font-size-body);font-weight:var(--font-weight-medium)}label span,.error{color:var(--color-danger)}.input-wrap{position:relative}.input-wrap :global(.ui-button){position:absolute;right:var(--space-1);top:2px}.input-wrap input{width:100%;height:44px;padding:0 var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-control);background:var(--color-surface);color:var(--color-text);font:inherit;font-size:var(--font-size-input);outline:0}.input-wrap:has(:global(.ui-button)) input{padding-right:48px}.input-wrap input:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px var(--color-primary-soft)}.input-wrap input[aria-invalid="true"]{border-color:var(--color-danger)}.helper,.error{margin:0;font-size:var(--font-size-helper)}.error{display:flex;gap:var(--space-1);align-items:center}</style>
