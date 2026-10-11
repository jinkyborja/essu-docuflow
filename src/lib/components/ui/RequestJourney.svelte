<script lang="ts">
	import {formatDate, nextStep, type JourneyEvent} from '$lib/request-flow';
	import { requestTimeline } from '$lib/student-request-display';
	let {status, dateRequested, history = [], hasFile = false, completed: completedAt = false, openByDefault = false}: {status:string;dateRequested:string;history?:JourneyEvent[];hasFile?:boolean;completed?:boolean;openByDefault?:boolean} = $props();
	const completed = $derived(completedAt || history.some(event => event.new_status === 'Completed'));
	const steps = $derived(requestTimeline(status, dateRequested, history, hasFile, completed));
	let userExpanded = $state<boolean | null>(null);
	const expanded = $derived(userExpanded ?? openByDefault);
	const id = $props.id();
</script>
<div class="rounded-lg border border-essu-green/20 bg-essu-green/5 p-3 space-y-2">
	<p class="text-sm font-medium text-gray-800">{completed ? 'Completed' : status === 'Correction Requested' ? 'Your next step' : status === 'Approved' ? 'Ready for release' : 'What happens next'}</p>
	<p class="text-xs text-gray-600">{nextStep(status,completed,hasFile)}</p>
	<button type="button" class="flex min-h-9 items-center gap-2 rounded-md px-1 text-xs font-medium text-essu-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-essu-green" aria-expanded={expanded} aria-controls={id} onclick={() => userExpanded = !expanded}><i class="fa-solid {expanded ? 'fa-chevron-up' : 'fa-chevron-down'}" aria-hidden="true"></i>Request timeline</button>
	{#if expanded}<ol {id} class="request-stepper ml-2 mt-2 text-xs text-gray-600">{#each steps as step}<li class="relative border-l-2 border-gray-200 pb-5 pl-5 last:border-transparent last:pb-1" data-step-state={step.state}><span class="absolute -left-[7px] top-0.5 h-3 w-3 rounded-full {step.state === 'done' ? 'bg-essu-green ring-2 ring-white' : step.state === 'current' ? 'border-2 border-essu-green bg-white ring-2 ring-essu-green/15' : 'bg-gray-300 ring-2 ring-white'}" aria-hidden="true"></span><span class="font-medium {step.state === 'current' ? 'text-essu-green' : ''}">{step.label}</span><span class="sr-only"> · {step.state}</span>{#if step.date}<span class="mt-0.5 block text-gray-500">{formatDate(step.date)}</span>{/if}{#if step.actor}<span class="block text-gray-500">{step.actor}</span>{/if}</li>{/each}</ol>{/if}
</div>
