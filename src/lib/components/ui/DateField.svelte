<script lang="ts">
	import TextField from './TextField.svelte';
	let {label,value=$bindable(''),id,name,required=false,helper='',error='',disabled=false,min,max}: {label:string;value?:string;id?:string;name?:string;required?:boolean;helper?:string;error?:string;disabled?:boolean;min?:string;max?:string}=$props();
</script>
<TextField {label} bind:value type="date" {id} {name} {required} {helper} {error} {disabled} {min} {max} />
