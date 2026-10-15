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
	.ui-stepper { display: flex; gap: 0; width: 100%; margin: 0; padding: 0; list-style: none; line-height: var(--line-height); }
	li { position: relative; display: flex; flex: 1 1 0; flex-direction: column; align-items: center; gap: var(--space-1); min-width: 0; padding-inline: var(--space-1); }
	li:not(:last-child)::after { position: absolute; top: 19px; left: calc(50% + 24px); width: calc(100% - 48px); height: 2px; background: var(--color-border); content: ''; }
	li.completed::after { background: var(--color-primary); }
	.step-number { position: relative; z-index: 1; display: grid; place-items: center; width: 40px; height: 40px; border: 1px solid var(--color-border); border-radius: 50%; background: var(--color-bg); color: var(--color-text-muted); font-size: var(--font-size-body); font-weight: var(--font-weight-medium); }
	li[aria-current='step'] .step-number { border-color: var(--color-primary); background: var(--color-primary); color: var(--color-surface); }
	.completed .step-number, :global(.completed-step.ui-button) { border-color: var(--color-primary); background: var(--color-primary); color: var(--color-surface); }
	:global(.completed-step.ui-button:hover:not(:disabled)) { background: var(--color-primary-hover); color: var(--color-surface); }
	:global(.completed-step.ui-button) { position: relative; z-index: 1; width: 40px; height: 40px; min-width: 40px; min-height: 40px; padding: 0; border-radius: 50%; }
	.step-label { max-width: 100%; color: var(--color-text-muted); font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); text-align: center; text-wrap: balance; overflow-wrap: anywhere; }
	li[aria-current='step'] .step-label { color: var(--color-primary); }
	@media (pointer: coarse) {
		.step-number, :global(.completed-step.ui-button) { width: 44px; height: 44px; min-width: 44px; min-height: 44px; }
		li:not(:last-child)::after { top: 21px; left: calc(50% + 26px); width: calc(100% - 52px); }
	}
</style>
