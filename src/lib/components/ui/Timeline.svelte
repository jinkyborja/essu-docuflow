<script lang="ts">
	import type { TimelineEvent } from '$lib/types';

	interface Props {
		events: TimelineEvent[];
	}

	const { events }: Props = $props();
</script>

<ol class="relative border-l border-gray-200 ml-3 space-y-6">
	{#each events as event}
		<li class="ml-6">
			<!-- Dot -->
			<span
				class="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white
					{event.status === 'completed'
						? 'bg-essu-green-mid'
						: event.status === 'current'
							? 'bg-essu-gold'
							: 'bg-gray-200'}"
			>
				{#if event.status === 'completed'}
					<i class="fa-solid fa-check text-white text-[10px]"></i>
				{:else if event.status === 'current'}
					<i class="fa-solid fa-circle text-white text-[8px]"></i>
				{:else}
					<i class="fa-regular fa-circle text-gray-400 text-[10px]"></i>
				{/if}
			</span>

			<div class="ml-1">
				<p class="text-sm font-semibold text-gray-800 {event.status === 'pending' ? 'text-gray-400' : ''}">
					{event.title}
				</p>
				{#if event.description}
					<p class="text-xs text-gray-500 mt-0.5">{event.description}</p>
				{/if}
				{#if event.date}
					<p class="text-xs text-gray-400 mt-0.5">
						<i class="fa-regular fa-clock mr-1"></i>{event.date}
					</p>
				{/if}
			</div>
		</li>
	{/each}
</ol>
