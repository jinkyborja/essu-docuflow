<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fly, fade } from 'svelte/transition';

	interface Props {
		open: boolean;
		title: string;
		size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
		onclose: () => void;
		body?: Snippet;
		footer?: Snippet;
	}

	const { open, title, size = 'md', onclose, body, footer }: Props = $props();

	const sizeClass: Record<string, string> = {
		sm: 'max-w-sm',
		md: 'max-w-lg',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl',
		'2xl': 'max-w-6xl'
	};

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		onclick={handleBackdrop}
	>
		<!-- Modal panel -->
		<div
			class="relative w-full {sizeClass[size]} bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
				<h2 id="modal-title" class="text-lg font-semibold text-gray-800">{title}</h2>
				<button
					onclick={onclose}
					class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark text-sm"></i>
				</button>
			</div>

			<!-- Body -->
			<div class="overflow-y-auto flex-1 px-6 py-4">
				{#if body}
					{@render body()}
				{/if}
			</div>

			<!-- Footer -->
			{#if footer}
				<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
