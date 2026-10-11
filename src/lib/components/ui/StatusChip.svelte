<script lang="ts">
	import { requestStatusKey, statusLabel, STATUS_COLORS } from '$lib/request-status';
	let { value, kind = 'request', size = 'md' }: { value: string | boolean | number; kind?: 'request' | 'id' | 'email' | 'file'; size?: 'sm' | 'md' } = $props();
	const key = $derived(typeof value === 'boolean' || typeof value === 'number' ? value ? 'verified' : 'pending' : String(value).trim().toLowerCase().replace(/\s+/g, '_'));
	const status = $derived(kind === 'request' ? requestStatusKey(key) : null);
	const labels: Record<string, string> = { missing: 'Missing', uploaded: 'Uploaded', needs_correction: 'Needs correction', in_person: 'In person' };
	const label = $derived(labels[key] ?? statusLabel(key));
	const icons: Record<string, string> = {missing:'fa-circle-minus',uploaded:'fa-circle-check',needs_correction:'fa-triangle-exclamation',in_person:'fa-building',pending:'fa-clock',correction_requested:'fa-rotate-left',approved:'fa-circle-check',verified:'fa-circle-check',rejected:'fa-circle-xmark',cancelled:'fa-ban',processing:'fa-gears',ready_for_pickup:'fa-box',released:'fa-handshake',completed:'fa-circle-check',unverified:'fa-envelope'};
	const classes = $derived(status ? STATUS_COLORS[status].classes : ['verified','uploaded','completed'].includes(key) ? kind === 'email' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-green-200 bg-green-50 text-green-800' : key === 'rejected' ? 'border-red-200 bg-red-50 text-red-800' : ['pending','needs_correction'].includes(key) ? 'border-amber-200 bg-amber-50 text-amber-900' : key === 'in_person' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-gray-200 bg-gray-50 text-gray-700');
</script>
<span class="ui-badge inline-flex max-w-full items-center gap-1.5 rounded-full border font-medium {size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'} text-xs {classes}" aria-label={`${kind === 'email' ? 'Email' : kind === 'id' ? 'ID' : kind === 'file' ? 'File' : 'Request'} status: ${label}`}><i class="fa-solid shrink-0 {icons[status ?? key] ?? 'fa-circle-info'}" aria-hidden="true"></i><span class={kind === 'request' ? 'whitespace-normal' : 'whitespace-nowrap'}>{label}</span></span>
