<script lang="ts">
	import { requestStatusKey, statusLabel } from '$lib/request-status';
	let { value, kind = 'request', size = 'md' }: { value: string | boolean | number; kind?: 'request' | 'id' | 'email' | 'file'; size?: 'sm' | 'md' } = $props();
	const key = $derived(typeof value === 'boolean' || typeof value === 'number' ? value ? 'verified' : 'pending' : String(value).trim().toLowerCase().replace(/\s+/g, '_'));
	const status = $derived(kind === 'request' ? requestStatusKey(key) : null);
	const labels: Record<string, string> = { missing: 'Missing', uploaded: 'Uploaded', needs_correction: 'Needs correction', in_person: 'In person' };
	const label = $derived(labels[key] ?? (kind === 'request' && key === 'completed' ? 'Released' : statusLabel(key)));
	const icons: Record<string, string> = { missing: 'fa-circle-minus', uploaded: 'fa-circle-check', needs_correction: 'fa-triangle-exclamation', in_person: 'fa-building', pending: 'fa-clock', correction_requested: 'fa-rotate-left', approved: 'fa-circle-check', verified: 'fa-circle-check', rejected: 'fa-circle-xmark', cancelled: 'fa-ban', processing: 'fa-gears', ready_for_pickup: 'fa-box', released: 'fa-handshake', completed: 'fa-circle-check', unverified: 'fa-envelope' };
	const requestTones: Record<string, string> = { pending: 'warning', correction_requested: 'warning', approved: 'success', processing: 'info', ready_for_pickup: 'info', released: 'success', rejected: 'danger', cancelled: 'neutral' };
	const tone = $derived(status ? requestTones[status] : ['verified', 'uploaded', 'completed'].includes(key) ? kind === 'email' ? 'info' : 'success' : key === 'rejected' ? 'danger' : ['pending', 'needs_correction'].includes(key) ? 'warning' : key === 'in_person' ? 'info' : 'neutral');
</script>

<span class="ui-badge status-chip tone-{tone} size-{size}" aria-label={`${kind === 'email' ? 'Email' : kind === 'id' ? 'ID' : kind === 'file' ? 'File' : 'Request'} status: ${label}`}>
	<i class="fa-solid {icons[status ?? key] ?? 'fa-circle-info'}" aria-hidden="true"></i><span>{label}</span>
</span>

<style>
	.status-chip { --chip-color: var(--color-text-muted); display: inline-flex; flex-shrink: 0; max-width: 100%; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3); border: 1px solid color-mix(in srgb, var(--chip-color) 30%, var(--color-surface)); border-radius: var(--radius-control); background: color-mix(in srgb, var(--chip-color) 8%, var(--color-surface)); color: var(--chip-color); font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); line-height: var(--line-height); white-space: nowrap; }
	.status-chip i { flex-shrink: 0; }
	.size-sm { padding-inline: var(--space-2); }
	.tone-success { --chip-color: var(--color-success); }
	.tone-warning { --chip-color: var(--color-warning); }
	.tone-danger { --chip-color: var(--color-danger); }
	.tone-info { --chip-color: var(--color-info); }
</style>
