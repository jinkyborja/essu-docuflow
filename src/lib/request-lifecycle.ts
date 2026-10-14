import { requestStatusKey } from '$lib/request-status';

export type LifecycleRequest = {
	status: string;
	archived_at?: string | Date | null;
	completed_at?: string | Date | null;
	history?: Array<{ new_status: string }>;
};

export function isReleased(request: LifecycleRequest): boolean {
	return !!request.completed_at || requestStatusKey(request.status) === 'released'
		|| !!request.history?.some(event => requestStatusKey(event.new_status) === 'released');
}

export function cancellationReason(request: LifecycleRequest): string {
	if (request.archived_at) return 'Archived requests cannot be cancelled';
	if (isReleased(request)) return 'Released requests cannot be cancelled';
	if (requestStatusKey(request.status) === 'cancelled') return 'This request is already cancelled';
	if (requestStatusKey(request.status) === 'rejected') return 'Rejected requests can be archived';
	if (!['pending', 'correction_requested', 'approved', 'processing', 'ready_for_pickup'].includes(requestStatusKey(request.status) ?? '')) return 'This request cannot be cancelled';
	return '';
}

export function archiveReason(request: LifecycleRequest): string {
	if (request.archived_at) return 'This request is already archived';
	if (!isReleased(request) && !['rejected', 'cancelled'].includes(requestStatusKey(request.status) ?? '')) return 'Only released, rejected or cancelled requests can be archived';
	return '';
}
