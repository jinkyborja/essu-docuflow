<script lang="ts">
	interface Step {
		label: string;
		icon: string;
	}

	interface Props {
		steps: Step[];
		currentStep: number;
	}

	const { steps, currentStep }: Props = $props();
</script>

<div class="flex items-center w-full">
	{#each steps as step, i}
		{@const stepNum = i + 1}
		{@const isCompleted = stepNum < currentStep}
		{@const isCurrent = stepNum === currentStep}

		<!-- Step -->
		<div class="flex flex-col items-center flex-1 min-w-0">
			<div
				class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all
					{isCompleted
						? 'bg-essu-green border-essu-green text-white'
						: isCurrent
							? 'bg-white border-essu-green text-essu-green shadow-sm'
							: 'bg-gray-100 border-gray-200 text-gray-400'}"
			>
				{#if isCompleted}
					<i class="fa-solid fa-check text-xs"></i>
				{:else}
					<i class="{step.icon} text-xs"></i>
				{/if}
			</div>
			<p
				class="text-xs mt-1.5 font-medium text-center leading-tight hidden sm:block
					{isCurrent ? 'text-essu-green' : isCompleted ? 'text-gray-600' : 'text-gray-400'}"
			>
				{step.label}
			</p>
		</div>

		<!-- Connector line (not after last step) -->
		{#if i < steps.length - 1}
			<div
				class="h-0.5 flex-1 mx-1 transition-colors
					{stepNum < currentStep ? 'bg-essu-green' : 'bg-gray-200'}"
			></div>
		{/if}
	{/each}
</div>
