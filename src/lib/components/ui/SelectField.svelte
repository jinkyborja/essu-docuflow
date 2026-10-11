<script lang="ts">
	import {onMount,type Snippet} from 'svelte';
	const generatedId = $props.id();
	let {label,value=$bindable(''),id=generatedId,name,required=false,helper='',error='',disabled=false,children,onchange}: {label:string;value?:any;id?:string;name?:string;required?:boolean;helper?:string;error?:string;disabled?:boolean;children?:Snippet;onchange?:()=>void}=$props();
	let control:HTMLSelectElement,touched=$state(false),localError=$state('');
	const message=$derived(error || (touched ? localError : ''));
	function validate(){touched=true;localError=control.validity.valueMissing ? `Choose ${label.toLowerCase()}.`: !control.validity.valid ? control.validationMessage:'';}
	onMount(()=>{control.addEventListener('ui-validate',validate);return()=>control.removeEventListener('ui-validate',validate);});
</script>
<div class="field" class:field-invalid={!!message}><label for={id}>{label}{#if required}<span class="field-required" aria-hidden="true"> *</span>{/if}</label><select bind:this={control} {id} {name} bind:value {required} {disabled} aria-invalid={!!message} aria-describedby={id+'-help'+(message?' '+id+'-error':'')} onblur={validate} onchange={()=>{if(touched)validate();onchange?.();}} oninvalid={validate}>{#if children}{@render children()}{/if}</select><p id={id+'-help'} class="field-helper">{helper}</p>{#if message}<p id={id+'-error'} class="field-error" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{message}</p>{/if}</div>
