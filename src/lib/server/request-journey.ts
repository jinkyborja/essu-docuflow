import pool from './db';
import { timedQuery } from './timing';
export async function attachRequestJourney(requests: Record<string, unknown>[]): Promise<void> {
	if (!requests.length) return;
	const ids = requests.map(row => String(row.request_id));
	const [rows] = await timedQuery('request-journey:history', () => pool.execute(`SELECT h.request_id, h.new_status, h.changed_at, u.role AS changed_by_role FROM request_status_history h LEFT JOIN users u ON u.user_id = h.changed_by WHERE h.request_id IN (${ids.map(() => '?').join(',')}) ORDER BY h.changed_at, h.history_id`, ids));
	for (const request of requests) {
		const history = (rows as Record<string, unknown>[]).filter(row => row.request_id === request.request_id)
			.map((row): Record<string, unknown> => ({ ...row, changed_by_name: row.changed_by_role === 'Student' ? 'You' : 'Graduate School Office' }));
		request.history = history;
		request.completed_at = history.find(row => row.new_status === 'Completed')?.changed_at ?? null;
	}
}
