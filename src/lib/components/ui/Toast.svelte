<script lang="ts">
	import { toasts, dismissToast } from '$lib/stores/toasts';
	import Button from './Button.svelte';
</script>
<div class="toast-region" aria-live="polite" aria-relevant="additions">
	{#each $toasts as toast (toast.id)}<div role={toast.kind === 'error' ? 'alert' : 'status'} class="toast-message" class:error={toast.kind === 'error'}><i aria-hidden="true" class="toast-icon fa-solid {toast.kind === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><p>{toast.message}</p><Button variant="ghost" size="sm" ariaLabel="Dismiss message" title="Dismiss message" icon="fa-solid fa-xmark" onclick={() => dismissToast(toast.id)} /></div>{/each}
</div>
<style>
	.toast-region { pointer-events: none; position: fixed; right: var(--space-6); bottom: var(--space-6); z-index: 100; display: flex; flex-direction: column; gap: var(--space-2); max-width: calc(100vw - var(--space-12)); }
	.toast-message { pointer-events: auto; display: flex; align-items: center; gap: var(--space-3); max-width: 448px; padding: var(--space-3) var(--space-4); border: 1px solid var(--color-success-border); border-radius: var(--radius-card); background: var(--color-surface); color: var(--color-text); font-size: var(--type-body); line-height: var(--line-height); box-shadow: none; animation: toast-enter 150ms ease; }
	.toast-message.error { border-color: var(--color-danger-border); }
	.toast-icon { flex: 0 0 var(--icon-size); color: var(--color-success); font-size: var(--icon-size); }
	.error .toast-icon { color: var(--color-danger); }
	p { flex: 1; min-width: 0; margin: 0; overflow-wrap: anywhere; }
	@keyframes toast-enter { from { opacity: 0; transform: translateY(var(--space-2)); } to { opacity: 1; transform: translateY(0); } }
	@media (max-width: 639px) { .toast-region { right: var(--space-4); bottom: var(--space-4); max-width: calc(100vw - var(--space-8)); } }
	@media (prefers-reduced-motion: reduce) { .toast-message { animation: none; } }
</style>
