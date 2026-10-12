<script lang="ts">
	import { toasts, dismissToast, type ToastMessage } from '$lib/stores/toasts';
	let { messages, inline = false, ondismiss = dismissToast }: { messages?: ToastMessage[]; inline?: boolean; ondismiss?: (id: number) => void } = $props();
	const displayedMessages = $derived(messages ?? $toasts);
</script>

<div class="toast-stack" class:inline aria-live="polite" aria-relevant="additions">
	{#each displayedMessages as toast (toast.id)}
		<div role={toast.kind === 'error' ? 'alert' : 'status'} class="toast-message" class:error={toast.kind === 'error'}>
			<i aria-hidden="true" class="fa-solid toast-icon {toast.kind === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i>
			<p>{toast.message}</p>
			<button type="button" aria-label="Dismiss message" title="Dismiss message" onclick={() => ondismiss(toast.id)}><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
		</div>
	{/each}
</div>

<style>
	.toast-stack { position: fixed; bottom: var(--space-6); right: var(--space-6); z-index: 100; display: flex; flex-direction: column; gap: var(--space-2); width: min(448px, calc(100vw - var(--space-12))); pointer-events: none; }
	.toast-stack.inline { position: static; width: 100%; z-index: auto; }
	.toast-message { --toast-color: var(--color-success); display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); border: 1px solid color-mix(in srgb, var(--toast-color) 40%, var(--color-surface)); border-radius: var(--radius-card); background: var(--color-surface); color: var(--color-text); font-size: var(--font-size-body); line-height: var(--line-height); pointer-events: auto; }
	.toast-message.error { --toast-color: var(--color-danger); }
	.toast-icon { flex-shrink: 0; color: var(--toast-color); font-size: var(--font-size-card-title); }
	p { flex: 1; min-width: 0; margin: 0; overflow-wrap: anywhere; }
	button { display: grid; flex-shrink: 0; place-items: center; width: var(--control-height); height: var(--control-height); border: 1px solid transparent; border-radius: var(--radius-control); background: transparent; color: var(--color-text-muted); transition: background-color var(--motion-fast), color var(--motion-fast); }
	button:hover { background: var(--color-primary-soft); color: var(--color-primary); }
	button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; box-shadow: var(--focus-ring); }
	@media (pointer: coarse) { button { width: var(--control-height-touch); height: var(--control-height-touch); } }
	@media (max-width: 639px) { .toast-stack { right: var(--space-4); bottom: var(--space-4); width: calc(100vw - var(--space-8)); } .toast-stack.inline { width: 100%; } }
</style>
