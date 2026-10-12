<script lang="ts">
	import TextField from './TextField.svelte';
	const generatedId=$props.id();
	let {id=generatedId,label,value=$bindable(''),required=false,disabled=false,helper='',error='',min,max}:{id?:string;label?:string;value?:string;required?:boolean;disabled?:boolean;helper?:string;error?:string;min?:string;max?:string}=$props();
</script>
<TextField {id} label={label ?? ''} bind:value type="date" {required} {disabled} {helper} {error} {min} {max} />
