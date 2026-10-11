export type AdminRequest = { request_id: string; student_code?: string | null; student_id?: string | null; first_name?: string; middle_name?: string | null; last_name?: string; date_requested: string; document_name?: string; items?: Array<{ document_id: number; name: string }> };
export async function fetchAdminRequests(): Promise<AdminRequest[]> {
	const response = await fetch('/api/requests');
	const result = await response.json();
	if (!response.ok || !Array.isArray(result)) throw new Error(result?.error ?? 'Could not load requests. Please try again.');
	return result;
}
export function studentHasRequests(id: string | null, requests: AdminRequest[]) {
	return requests.some(request => (request.student_code ?? request.student_id ?? '').trim() === (id ?? '').trim());
}
export function documentHasRequests(id: number, requests: AdminRequest[]) {
	return requests.some(request => request.items?.some(item => item.document_id === id));
}
export function recentActivity(history: Array<Record<string, unknown>>, requests: AdminRequest[]) {
	const submissions = requests.map(request => ({...request, event_id: 'submitted-' + request.request_id, new_status: 'Request submitted', changed_at: request.date_requested, document_name: request.document_name ?? request.items?.map(item => item.name).join(' + ') ?? ''}));
	const seen = new Set<string>();
	const events: Array<Record<string, unknown> & { event_id: string }> = [...history.map(event => ({...event, event_id: 'history-' + event.history_id})), ...submissions];
	return events.filter(event => {
		if (seen.has(event.event_id)) return false;
		seen.add(event.event_id); return true;
	}).sort((a, b) => new Date(String(b.changed_at)).getTime() - new Date(String(a.changed_at)).getTime()).slice(0, 5);
}
