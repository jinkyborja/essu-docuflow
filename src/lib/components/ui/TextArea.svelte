<script lang="ts">
	import {onMount} from 'svelte';
	const generatedId = $props.id();
	let {label,value=$bindable(''),id=generatedId,name,required=false,helper='',error='',disabled=false,rows=3,minlength,maxlength,placeholder=''}: {label:string;value?:string;id?:string;name?:string;required?:boolean;helper?:string;error?:string;disabled?:boolean;rows?:number;minlength?:number;maxlength?:number;placeholder?:string}=$props();
	let control:HTMLTextAreaElement,touched=$state(false),localError=$state('');
	const message=$derived(error || (touched ? localError : ''));
	function validate(){touched=true;const length=value.trim().length;const custom=required && !length ? `Enter ${label.toLowerCase()}.`:minlength && length && length<minlength ? `Enter at least ${minlength} characters.`:'';control.setCustomValidity(custom);localError=custom;}
	onMount(()=>{control.addEventListener('ui-validate',validate);return()=>control.removeEventListener('ui-validate',validate);});
</script>
<div class="field" class:field-invalid={!!message}><label for={id}>{label}{#if required}<span class="field-required" aria-hidden="true"> *</span>{/if}</label><textarea bind:this={control} {id} {name} bind:value {required} {disabled} {rows} {minlength} {maxlength} {placeholder} aria-invalid={!!message} aria-describedby={id+'-help'+(message?' '+id+'-error':'')} onblur={validate} oninput={()=>{control.setCustomValidity('');if(touched)validate();}} oninvalid={validate}></textarea><p id={id+'-help'} class="field-helper">{helper}</p>{#if message}<p id={id+'-error'} class="field-error" role="alert"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{message}</p>{/if}</div>
