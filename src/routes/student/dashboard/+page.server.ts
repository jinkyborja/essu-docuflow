import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';

export const load: PageServerLoad = async ({ parent }) => {
	const { userId } = await parent();

	const [requests] = await pool.execute(
		`SELECT r.request_id, d.name AS document_name, r.status, r.date_requested
		 FROM requests r
		 JOIN documents d ON r.document_id = d.document_id
		 WHERE r.student_id = ? AND r.status != 'Rejected'
		 ORDER BY r.date_requested DESC`,
		[userId]
	);

	const [recentHistory] = await pool.execute(
		`SELECT h.history_id, h.request_id, h.new_status, h.changed_at, d.name AS document_name
		 FROM request_status_history h
		 JOIN requests r ON h.request_id = r.request_id
		 JOIN documents d ON r.document_id = d.document_id
		 WHERE r.student_id = ?
		 ORDER BY h.changed_at DESC
		 LIMIT 4`,
		[userId]
	);

	return {
		requests: requests as Record<string, unknown>[],
		recentHistory: recentHistory as Record<string, unknown>[]
	};
};
