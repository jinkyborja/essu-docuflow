<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	interface Step { label: string; icon: string; }
	let { steps, currentStep, disabled = false, onstepselect }: { steps: Step[]; currentStep: number; disabled?: boolean; onstepselect?: (step: number) => void } = $props();
</script>

<ol class="ui-stepper" aria-label="Request steps">
	{#each steps as step, i}
		{@const stepNum = i + 1}
		<li class:completed={stepNum < currentStep} aria-current={stepNum === currentStep ? 'step' : undefined}>
			{#if stepNum < currentStep && onstepselect}
				<Button variant="ghost" icon="fa-solid fa-check" ariaLabel={`Return to ${step.label}`} title={`Return to ${step.label}`} {disabled} onclick={() => onstepselect?.(stepNum)} class="completed-step" />
			{:else}<span class="step-number" aria-hidden="true">{#if stepNum < currentStep}<i class="fa-solid fa-check"></i>{:else}{stepNum}{/if}</span>{/if}
			<span class="step-label">{step.label}</span>
		</li>
	{/each}
</ol>

<style>
	.ui-stepper { display: flex; gap: var(--space-4); width: 100%; margin: 0; padding: 0; list-style: none; line-height: var(--line-height); }
	li { position: relative; display: flex; flex: 1; flex-direction: column; align-items: center; gap: var(--space-2); min-width: 0; }
	li:not(:last-child)::after { position: absolute; top: 19px; left: calc(50% + 28px); width: calc(100% - 40px); height: 2px; background: var(--color-border); content: ''; }
	li.completed::after { background: var(--color-primary); }
	.step-number { display: grid; place-items: center; width: var(--control-height); height: var(--control-height); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-bg); color: var(--color-text-muted); font-size: var(--font-size-body); font-weight: var(--font-weight-medium); }
	li[aria-current='step'] .step-number { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); }
	.completed .step-number, :global(.completed-step.ui-button) { border-color: var(--color-primary); background: var(--color-primary); color: var(--color-surface); }
	:global(.completed-step.ui-button:hover:not(:disabled)) { background: var(--color-primary-hover); color: var(--color-surface); }
	:global(.completed-step.ui-button) { padding: 0; }
	.step-label { color: var(--color-text-muted); font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); text-align: center; }
	li[aria-current='step'] .step-label { color: var(--color-primary); }
	@media (pointer: coarse) { .step-number { width: var(--control-height-touch); height: var(--control-height-touch); } li:not(:last-child)::after { top: 21px; } }
</style>
