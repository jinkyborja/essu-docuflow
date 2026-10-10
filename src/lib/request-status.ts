export const REQUEST_STATUSES = ['pending', 'correction_requested', 'approved', 'processing', 'ready_for_pickup', 'released', 'rejected', 'cancelled'] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

export const STATUS_COLORS: Record<RequestStatus, { color: string; classes: string }> = {
	pending: { color: '#96600b', classes: 'bg-orange-100 text-orange-700 border border-orange-200' },
	correction_requested: { color: '#b58900', classes: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
	approved: { color: '#28724d', classes: 'bg-green-100 text-green-700 border border-green-200' },
	processing: { color: '#2563eb', classes: 'bg-blue-100 text-blue-700 border border-blue-200' },
	ready_for_pickup: { color: '#0d9488', classes: 'bg-teal-100 text-teal-700 border border-teal-200' },
	released: { color: '#7c3aed', classes: 'bg-purple-100 text-purple-700 border border-purple-200' },
	rejected: { color: '#a93e3b', classes: 'bg-red-100 text-red-700 border border-red-200' },
	cancelled: { color: '#64748b', classes: 'bg-slate-100 text-slate-700 border border-slate-200' }
};

const labels: Record<RequestStatus, string> = {
	pending: 'Pending review', correction_requested: 'Needs correction', approved: 'Approved',
	processing: 'Processing', ready_for_pickup: 'Ready for pickup', released: 'Released',
	rejected: 'Rejected', cancelled: 'Cancelled'
};

export function requestStatusKey(value: string): RequestStatus | null {
	const key = value.trim().toLowerCase().replace(/\s+/g, '_');
	return REQUEST_STATUSES.includes(key as RequestStatus) ? key as RequestStatus : null;
}

export function statusLabel(value: string): string {
	const key = requestStatusKey(value);
	return key ? labels[key] : value.charAt(0).toUpperCase() + value.slice(1);
}
