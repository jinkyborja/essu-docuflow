<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { tick } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
		onclose: () => void;
		body?: Snippet;
		footer?: Snippet;
	}

	const { open, title, size = 'md', onclose, body, footer }: Props = $props();
	const titleId = $props.id();

	function manageFocus(panel: HTMLElement) {
		const previousFocus = document.activeElement as HTMLElement | null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const controls = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
		let active = true;
		void tick().then(() => { if (active) panel.focus(); });
		const trap = (event: KeyboardEvent) => {
			if (event.key !== 'Tab') return;
			const items = controls(), first = items[0], last = items[items.length - 1];
			if (!first) { event.preventDefault(); panel.focus(); return; }
			if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
			else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first.focus(); }
		};
		panel.addEventListener('keydown', trap);
		return { destroy() { active = false; panel.removeEventListener('keydown', trap); document.body.style.overflow = previousOverflow; previousFocus?.focus(); } };
	}

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
		if (open && e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="ui-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
		role="presentation"
		onclick={handleBackdrop}
	>
		<!-- Modal panel -->
		<div
			use:manageFocus
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			tabindex="-1"
			class="ui-modal-panel relative w-full {sizeClass[size]} bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
				<h2 id={titleId} class="text-lg font-semibold text-gray-800">{title}</h2>
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
