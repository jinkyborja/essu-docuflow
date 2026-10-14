<script lang="ts">
	import {formatDate, nextStep, type JourneyEvent} from '$lib/request-flow';
	import { requestTimeline } from '$lib/student-request-display';
	import Button from './Button.svelte';
	import { requestStatusKey } from '$lib/request-status';
	let {status, dateRequested, history = [], hasFile = false, completed: completedAt = false, openByDefault = false, compact = false}: {status:string;dateRequested:string;history?:JourneyEvent[];hasFile?:boolean;completed?:boolean;openByDefault?:boolean;compact?:boolean} = $props();
	const completed = $derived(completedAt || requestStatusKey(status) === 'released' || history.some(event => requestStatusKey(event.new_status) === 'released'));
	const steps = $derived(requestTimeline(status, dateRequested, history, hasFile, completed));
	let userExpanded = $state<boolean | null>(null);
	const expanded = $derived(userExpanded ?? openByDefault);
	const id = $props.id();
</script>
<div class="request-journey" class:compact>
	{#if !compact}
		<p class="journey-title">{completed ? 'Released' : requestStatusKey(status) === 'cancelled' ? 'Request cancelled' : status === 'Correction Requested' ? 'Your next step' : ['approved', 'ready_for_pickup'].includes(requestStatusKey(status) ?? '') ? 'Ready for Release' : 'What happens next'}</p>
		<p class="journey-description">{nextStep(status,completed,hasFile)}</p>
		<Button variant="ghost" icon={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} ariaExpanded={expanded} ariaControls={id} onclick={() => userExpanded = !expanded}>Request timeline</Button>
	{/if}
	{#if compact || expanded}
		<ol {id} class="request-stepper" aria-label="Request progress">
			{#each steps as step}
				<li data-step-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
					<span class="step-marker" aria-hidden="true">{#if step.state === 'done'}<i class="fa-solid fa-check"></i>{/if}</span>
					<div class="step-copy"><span class="step-label">{step.label}</span><span class="sr-only"> · {step.state}</span>{#if !compact && step.date}<span class="step-detail">{formatDate(step.date)}</span>{/if}{#if !compact && step.actor}<span class="step-detail">{step.actor}</span>{/if}</div>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.request-journey { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-bg); line-height: var(--line-height); }
	.request-journey.compact { padding: 0; border: 0; background: transparent; }
	p { margin: 0; }
	.journey-title { color: var(--color-text); font-size: var(--font-size-body); font-weight: var(--font-weight-medium); }
	.journey-description { color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.request-stepper { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
	li { position: relative; display: flex; flex: 1; gap: var(--space-3); min-width: 0; padding-bottom: var(--space-6); }
	li:last-child { padding-bottom: 0; }
	li:not(:last-child)::after { position: absolute; top: 24px; bottom: 0; left: 11px; width: 2px; background: var(--color-border); content: ''; }
	li[data-step-state='done']::after { background: var(--color-primary); }
	.step-marker { position: relative; z-index: 1; display: grid; place-items: center; flex-shrink: 0; width: 24px; height: 24px; border: 2px solid var(--color-border); border-radius: 50%; background: var(--color-surface); color: var(--color-text-muted); font-size: var(--font-size-helper); }
	[data-step-state='done'] .step-marker { border-color: var(--color-primary); background: var(--color-primary); color: var(--color-surface); }
	[data-step-state='current'] .step-marker { border-color: var(--color-primary); box-shadow: var(--focus-ring); }
	.step-copy { min-width: 0; color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.step-label { color: var(--color-text); font-weight: var(--font-weight-medium); }
	[data-step-state='current'] .step-label { color: var(--color-primary); }
	.step-detail { display: block; margin-top: var(--space-1); overflow-wrap: anywhere; }
	@media (min-width: 640px) {
		.request-stepper { flex-direction: row; overflow-x: auto; padding: var(--space-1); }
		li { flex: 1 0 120px; flex-direction: column; gap: var(--space-2); padding: 0 var(--space-4) 0 0; }
		li:not(:last-child)::after { top: 11px; right: 0; bottom: auto; left: 24px; width: auto; height: 2px; }
	}
</style>
