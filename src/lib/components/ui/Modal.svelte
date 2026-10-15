<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import Button from './Button.svelte';

	interface Props {
		open: boolean;
		title: string;
		size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
		onclose: () => void;
		body?: Snippet;
		footer?: Snippet;
		headerActions?: Snippet;
		closeDisabled?: boolean;
		descriptionId?: string;
		panelClass?: string;
	}

	const { open, title, size = 'md', onclose, body, footer, headerActions, closeDisabled = false, descriptionId, panelClass = '' }: Props = $props();
	const titleId = $props.id();
	let panel = $state<HTMLDivElement>();

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
		if (!closeDisabled && e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open || closeDisabled || e.key !== 'Escape' || e.defaultPrevented) return;
		const dialogs = document.querySelectorAll('[role="dialog"]');
		if (dialogs[dialogs.length - 1] === panel) { e.preventDefault(); onclose(); }
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="ui-modal-backdrop"
		role="presentation"
		onclick={handleBackdrop}
	>
		<!-- Modal panel -->
		<div
			bind:this={panel}
			use:manageFocus
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			aria-describedby={descriptionId}
			tabindex="-1"
			class="ui-modal-panel {sizeClass[size]} {panelClass}"
		>
			<!-- Header -->
			<div class="modal-header">
				<h2 id={titleId}>{title}</h2>
				{#if headerActions}<div class="modal-header-actions">{@render headerActions()}</div>{/if}
				<Button variant="ghost" icon="fa-solid fa-xmark" ariaLabel="Close modal" onclick={onclose} disabled={closeDisabled} />
			</div>

			<!-- Body -->
			<div class="modal-body">
				{#if body}
					{@render body()}
				{/if}
			</div>

			<!-- Footer -->
			{#if footer}
				<div class="modal-footer">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.ui-modal-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: var(--space-4); background: color-mix(in srgb, var(--color-text) 56%, transparent); transition: opacity var(--motion-fast); }
	.ui-modal-panel { position: relative; display: flex; flex-direction: column; width: 100%; max-height: calc(100dvh - var(--space-8)); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: var(--color-surface); color: var(--color-text); font-size: var(--font-size-body); line-height: var(--line-height); transition: opacity var(--motion-fast), transform var(--motion-fast); }
	.modal-header { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--color-border); }
	.modal-header-actions { margin-left: auto; }
	h2 { margin: 0; font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); }
	.modal-body { flex: 1; overflow-y: auto; padding: var(--space-6); }
	.modal-footer { display: flex; flex-shrink: 0; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-6); border-top: 1px solid var(--color-border); }
	@starting-style { .ui-modal-backdrop { opacity: 0; } .ui-modal-panel { opacity: 0; transform: translateY(var(--space-2)); } }
	@media (max-width: 639px) { .ui-modal-backdrop { padding: var(--space-4); } .ui-modal-panel { max-height: 90dvh; border-radius: var(--radius-panel); } .modal-header, .modal-footer, .modal-body { padding-left: var(--space-4); padding-right: var(--space-4); } }
</style>
