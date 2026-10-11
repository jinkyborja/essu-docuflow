<script lang="ts">let { label = 'Loading this page…' }: { label?: string } = $props();</script>
<div role="status" aria-live="polite" aria-busy="true" class="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
	<p class="flex items-center gap-2 text-sm font-medium text-essu-green"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>{label}</p>
	<div class="space-y-3 animate-pulse" aria-hidden="true"><div class="h-5 w-1/3 rounded bg-gray-100"></div><div class="h-4 w-2/3 rounded bg-gray-100"></div><div class="h-20 w-full rounded-lg bg-gray-100"></div></div>
</div>
