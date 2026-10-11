<script lang="ts">
	import { onMount } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	const generatedId = $props.id();
	let { label, value = $bindable(''), type = 'text', id = generatedId, name, required = false, helper = '', error = '', placeholder = '', disabled = false, readonly = false, minlength, maxlength, min, max, pattern, autocomplete, passwordRules = false, validator, onblur, oninput }: {label:string;value?:string | number | null;type?:string;id?:string;name?:string;required?:boolean;helper?:string;error?:string;placeholder?:string;disabled?:boolean;readonly?:boolean;minlength?:number;maxlength?:number;min?:string | number;max?:string | number;pattern?:string;autocomplete?:HTMLInputAttributes['autocomplete'];passwordRules?:boolean;validator?:(value:string)=>string;onblur?:()=>void;oninput?:(event: Event & {currentTarget:HTMLInputElement})=>void} = $props();
	let control: HTMLInputElement, touched = $state(false), localError = $state(''), showPassword = $state(false);
	const message = $derived(error || (touched ? localError : ''));
	function validate() { touched = true; const custom = validator?.(control.value) ?? ''; control.setCustomValidity(custom); localError = custom || (control.validity.valueMissing ? `Enter ${label.toLowerCase()}.` : !control.validity.valid ? control.validationMessage : ''); }
	onMount(() => { control.addEventListener('ui-validate', validate); return () => control.removeEventListener('ui-validate', validate); });
</script>
<div class="field" class:field-invalid={!!message}>
	<label for={id}>{label}{#if required}<span class="field-required" aria-hidden="true"> *</span>{/if}{#if readonly}<i class="fa-solid fa-lock field-lock" aria-hidden="true"></i>{/if}</label>
	<div class="field-control-wrap"><input bind:this={control} {id} {name} type={type === 'password' && showPassword ? 'text' : type} bind:value {required} {disabled} {readonly} {minlength} {maxlength} {min} {max} {pattern} {placeholder} {autocomplete} aria-invalid={!!message} aria-describedby={id + '-help' + (message ? ' ' + id + '-error' : '')} onblur={() => { validate(); onblur?.(); }} oninput={(event) => { control.setCustomValidity(''); if (touched) validate(); oninput?.(event); }} oninvalid={() => { touched = true; validate(); }} />{#if type === 'password'}<button type="button" {disabled} class="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onclick={() => showPassword = !showPassword}><i class="fa-regular {showPassword ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i></button>{/if}</div>
	<p id={id + '-help'} class="field-helper">{readonly ? 'This field is locked. Contact the office to update it.' : helper}</p>
	{#if passwordRules}<ul class="password-rules" aria-label="Password rules"><li class:rule-met={String(value ?? '').length >= 8}><i class="fa-solid {String(value ?? '').length >= 8 ? 'fa-circle-check' : 'fa-circle'}" aria-hidden="true"></i>At least 8 characters</li></ul>{/if}
	{#if message}<p id={id + '-error'} class="field-error" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{message}</p>{/if}
</div>
<style>
	.field-control-wrap {position:relative;} .field-control-wrap:has(.password-toggle) input {padding-right:48px;}
	.password-toggle {position:absolute;right:2px;top:0;width:44px;height:44px;display:grid;place-items:center;border-radius:var(--radius-control);color:var(--color-text-muted);} .password-toggle:hover {color:var(--color-primary);background:var(--color-primary-soft);}
	.password-rules {font-size:var(--type-helper);color:var(--color-text-muted);} .password-rules li {display:flex;gap:var(--space-2);align-items:center;} .password-rules .rule-met {color:var(--color-success);}
</style>
