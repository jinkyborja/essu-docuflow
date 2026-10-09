import pool from './db';
export async function attachRequestJourney(requests: Record<string, unknown>[]): Promise<void> {
	if (!requests.length) return;
	const ids = requests.map(row => String(row.request_id));
	const [rows] = await pool.execute(`SELECT h.request_id, h.new_status, h.changed_at, CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name FROM request_status_history h LEFT JOIN users u ON u.user_id = h.changed_by WHERE h.request_id IN (${ids.map(() => '?').join(',')}) ORDER BY h.changed_at, h.history_id`, ids);
	for (const request of requests) {
		const history = (rows as Record<string, unknown>[]).filter(row => row.request_id === request.request_id);
		request.history = history;
		request.completed_at = history.find(row => row.new_status === 'Completed')?.changed_at ?? null;
	}
}
