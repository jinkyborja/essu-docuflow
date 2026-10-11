<script lang="ts">
	import { toasts, dismissToast } from '$lib/stores/toasts';
</script>
<div class="pointer-events-none fixed bottom-5 right-5 z-[100] flex max-w-[calc(100vw-40px)] flex-col gap-2" aria-live="polite" aria-relevant="additions">
	{#each $toasts as toast (toast.id)}<div role={toast.kind === 'error' ? 'alert' : 'status'} class="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg {toast.kind === 'error' ? 'border-red-200 text-red-800' : 'border-green-200 text-green-900'}"><i aria-hidden="true" class="fa-solid {toast.kind === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} mt-1"></i><p class="flex-1">{toast.message}</p><button type="button" aria-label="Dismiss message" title="Dismiss message" onclick={() => dismissToast(toast.id)} class="flex min-h-9 min-w-9 items-center justify-center rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-essu-green/30"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>{/each}
</div>
<style>@media (pointer: coarse) { button { min-width: 44px; min-height: 44px; } }</style>
