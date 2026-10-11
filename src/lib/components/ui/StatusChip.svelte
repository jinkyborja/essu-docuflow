<script lang="ts">
	import { requestStatusKey, statusLabel, STATUS_COLORS } from '$lib/request-status';
	let { value, kind = 'request', size = 'md' }: { value: string | boolean | number; kind?: 'request' | 'id' | 'email' | 'file'; size?: 'sm' | 'md' } = $props();
	const key = $derived(typeof value === 'boolean' || typeof value === 'number' ? value ? 'verified' : 'pending' : String(value).trim().toLowerCase().replace(/\s+/g, '_'));
	const status = $derived(kind === 'request' ? requestStatusKey(key) : null);
	const labels: Record<string, string> = { missing: 'Missing', uploaded: 'Uploaded', needs_correction: 'Needs correction', in_person: 'In person' };
	const label = $derived(kind === 'request' && status === 'pending' ? 'Pending review' : kind === 'request' && status === 'correction_requested' ? 'Needs correction' : labels[key] ?? statusLabel(key));
	const icons: Record<string, string> = {missing:'fa-circle-minus',uploaded:'fa-circle-check',needs_correction:'fa-triangle-exclamation',in_person:'fa-building',pending:'fa-clock',correction_requested:'fa-rotate-left',approved:'fa-circle-check',verified:'fa-circle-check',rejected:'fa-circle-xmark',cancelled:'fa-ban',processing:'fa-gears',ready_for_pickup:'fa-box',released:'fa-handshake',completed:'fa-circle-check',unverified:'fa-envelope'};
	const classes = $derived(status ? STATUS_COLORS[status].classes : ['verified','uploaded','completed'].includes(key) ? kind === 'email' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-green-200 bg-green-50 text-green-800' : key === 'rejected' ? 'border-red-200 bg-red-50 text-red-800' : ['pending','needs_correction'].includes(key) ? 'border-amber-200 bg-amber-50 text-amber-900' : key === 'in_person' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-gray-200 bg-gray-50 text-gray-700');
	const tones: Record<string, string> = { pending: 'warning', correction_requested: 'correction', approved: 'success', processing: 'info', ready_for_pickup: 'ready', released: 'released', rejected: 'danger', cancelled: 'neutral', completed: 'success', uploaded: 'success', needs_correction: 'warning', in_person: 'info', unverified: 'neutral' };
	const tone = $derived(key === 'verified' ? kind === 'email' ? 'info' : 'success' : tones[status ?? key] ?? 'neutral');
</script>
<span class="ui-badge chip-{size} tone-{tone} inline-flex max-w-full items-center rounded-full border font-medium text-xs {classes}" aria-label={`${kind === 'email' ? 'Email' : kind === 'id' ? 'ID' : kind === 'file' ? 'File' : 'Request'} status: ${label}`}><i class="fa-solid shrink-0 {icons[status ?? key] ?? 'fa-circle-info'}" aria-hidden="true"></i><span class={kind === 'request' ? 'whitespace-normal' : 'whitespace-nowrap'}>{label}</span></span>
<style>
	.ui-badge { gap: var(--space-2); min-height: var(--space-6); padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill); font-size: var(--type-helper); font-weight: var(--weight-medium); line-height: var(--line-height); white-space: normal; }
	.chip-sm { padding-inline: var(--space-2); }
	i { width: var(--type-helper); font-size: var(--type-helper); text-align: center; }
	.tone-warning { color: var(--color-warning-text); background: var(--color-warning-wash); border-color: var(--color-warning-border); }
	.tone-correction { color: var(--color-correction); background: var(--color-correction-wash); border-color: var(--color-warning-border); }
	.tone-success { color: var(--color-success); background: var(--color-success-wash); border-color: var(--color-success-border); }
	.tone-danger { color: var(--color-danger); background: var(--color-danger-wash); border-color: var(--color-danger-border); }
	.tone-info { color: var(--color-info); background: var(--color-info-wash); border-color: var(--color-info-border); }
	.tone-ready { color: var(--color-ready); background: var(--color-ready-soft); border-color: var(--color-ready-border); }
	.tone-released { color: var(--color-released); background: var(--color-released-soft); border-color: var(--color-released-border); }
	.tone-neutral { color: var(--color-text-muted); background: var(--color-surface-muted); border-color: var(--color-border); }
</style>
