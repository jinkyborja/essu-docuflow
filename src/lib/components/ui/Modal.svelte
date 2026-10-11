<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import Button from './Button.svelte';
	import type ConfirmDialog from './ConfirmDialog.svelte';

	interface Props {
		open: boolean;
		title: string;
		size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
		onclose: () => void;
		body?: Snippet;
		footer?: Snippet;
		closeDisabled?: boolean;
		descriptionId?: string;
		headerActions?: Snippet;
		width?: string;
		dirty?: boolean;
		trackDirty?: boolean;
	}

	const { open, title, size = 'md', onclose, body, footer, closeDisabled = false, descriptionId, headerActions, width, dirty = false, trackDirty = true }: Props = $props();
	const titleId = $props.id();
	let panel = $state<HTMLDivElement>();
	let changed = $state(false), discardOpen = $state(false);
	let DiscardDialog = $state<typeof ConfirmDialog | null>(null);
	$effect(() => { if (!open) { changed = false; discardOpen = false; } });
	async function requestClose() { if (closeDisabled) return; if (dirty || changed) { DiscardDialog = (await import('./ConfirmDialog.svelte')).default; discardOpen = true; } else onclose(); }

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
		const markDirty = (event: Event) => { const target = event.target as HTMLInputElement; if (trackDirty && (target.closest('form') || target.type === 'file')) changed = true; };
		const cancelClick = (event: MouseEvent) => { const button = (event.target as HTMLElement).closest('button'); if ((dirty || changed) && button?.closest('.modal-footer') && /^(Cancel|Close)$/.test(button.textContent?.trim() ?? '')) { event.preventDefault(); event.stopImmediatePropagation(); requestClose(); } };
		panel.addEventListener('input', markDirty); panel.addEventListener('change', markDirty); panel.addEventListener('click', cancelClick, true);
		return { destroy() { active = false; panel.removeEventListener('keydown', trap); panel.removeEventListener('input', markDirty); panel.removeEventListener('change', markDirty); panel.removeEventListener('click', cancelClick, true); document.body.style.overflow = previousOverflow; previousFocus?.focus(); } };
	}

	const sizeClass: Record<string, string> = {
		sm: 'max-w-sm',
		md: 'max-w-lg',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl',
		'2xl': 'max-w-6xl'
	};

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) requestClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open || e.key !== 'Escape' || e.defaultPrevented) return;
		const dialogs = document.querySelectorAll('[role="dialog"]');
		if (dialogs[dialogs.length - 1] === panel) { e.preventDefault(); requestClose(); }
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="ui-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
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
			class="ui-modal-panel relative w-full {sizeClass[size]} flex flex-col max-h-[90vh]"
			style:max-width={width}
		>
			<!-- Header -->
			<div class="modal-header flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
				<h2 id={titleId} class="modal-title">{title}</h2>
				<div class="flex items-center gap-2">{#if headerActions}{@render headerActions()}{/if}<Button variant="ghost" size="sm" onclick={requestClose} disabled={closeDisabled} ariaLabel="Close modal" title="Close modal" icon="fa-solid fa-xmark" /></div>
			</div>

			<!-- Body -->
			<div class="overflow-y-auto flex-1 px-6 py-4">
				{#if body}
					{@render body()}
				{/if}
			</div>

			<!-- Footer -->
			{#if footer}
				<div class="modal-footer flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
{#if open && discardOpen && DiscardDialog}<DiscardDialog open title="Discard changes?" message="You have unsaved changes. Closing this form will discard them." confirmLabel="Discard changes" cancelLabel="Keep editing" onclose={() => discardOpen = false} onconfirm={() => { discardOpen = false; changed = false; onclose(); }} />{/if}
<style>
	.ui-modal-backdrop { background: var(--color-overlay); animation: modal-enter 150ms ease; }
	.ui-modal-panel { border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: var(--color-surface); color: var(--color-text); box-shadow: none; font-size: var(--type-body); line-height: var(--line-height); }
	.modal-title { font-size: var(--type-card-title); font-weight: var(--weight-semibold); line-height: var(--line-height); }
	.modal-header,.modal-footer { position: sticky; z-index: 1; background: var(--color-surface); } .modal-header {top:0;} .modal-footer {bottom:0;}
	@media(max-width:639px) { .ui-modal-backdrop {align-items:flex-end;padding:0;} .ui-modal-panel {border-radius:var(--radius-panel) var(--radius-panel) 0 0;max-height:90dvh;} .ui-modal-panel > div {padding-inline:var(--space-4);} }
	@keyframes modal-enter { from { opacity: 0; } to { opacity: 1; } }
	@media (prefers-reduced-motion: reduce) { .ui-modal-backdrop { animation: none; } }
</style>
