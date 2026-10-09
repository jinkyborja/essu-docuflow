<script lang="ts">
	import {formatDate, nextStep, type JourneyEvent} from '$lib/request-flow';
	let {status, dateRequested, history = [], hasFile = false}: {status:string;dateRequested:string;history?:JourneyEvent[];hasFile?:boolean} = $props();
	const completed = $derived(history.some(event => event.new_status === 'Completed'));
</script>
<div class="rounded-lg border border-essu-green/20 bg-essu-green/5 p-3 space-y-2">
	<p class="text-sm font-medium text-gray-800">{completed ? 'Completed' : status === 'Correction Requested' ? 'Your next step' : status === 'Approved' ? 'Ready for release' : 'What happens next'}</p>
	<p class="text-xs text-gray-600">{nextStep(status,completed,hasFile)}</p>
	<details class="text-xs text-gray-600"><summary class="cursor-pointer text-essu-green focus:outline-none focus:ring-2 focus:ring-essu-green/30">Request timeline</summary>
		<ol class="mt-2 space-y-2 border-l border-essu-green/30 pl-3"><li>Submitted - {formatDate(dateRequested)}</li>{#each history as event}<li>{event.new_status === 'Completed' ? 'Delivery recorded' : event.new_status} - {formatDate(event.changed_at)}{#if event.changed_by_name}<span class="block text-gray-500">{event.changed_by_name}</span>{/if}</li>{/each}</ol>
	</details>
</div>
