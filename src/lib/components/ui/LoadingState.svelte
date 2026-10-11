<script lang="ts">import Skeleton from './Skeleton.svelte'; let { label = 'Loading this page…' }: { label?: string } = $props();</script>
<div role="status" aria-live="polite" aria-busy="true" class="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
	<p class="flex items-center gap-2 text-sm font-medium text-essu-green"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>{label}</p>
	<Skeleton announce={false} />
</div>
