import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';

export const load: PageServerLoad = async ({ parent }) => {
	const { userId } = await parent();

	const [history] = await pool.execute(
		`SELECT h.history_id, h.request_id, h.new_status, h.old_status, h.changed_at, h.student_read,
		        d.name AS document_name, r.admin_message
		 FROM request_status_history h
		 JOIN requests r ON h.request_id = r.request_id
		 JOIN documents d ON r.document_id = d.document_id
		 WHERE r.student_id = ?
		 ORDER BY h.changed_at DESC`,
		[userId]
	);

	return { history: history as Record<string, unknown>[] };
};
