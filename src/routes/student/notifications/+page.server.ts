import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';

export const load: PageServerLoad = async ({ parent }) => {
	const { userId } = await parent();

	const [history] = await pool.execute(
		`SELECT h.history_id, h.request_id, h.new_status, h.old_status, h.changed_at, h.student_read,
		        GROUP_CONCAT(DISTINCT d.name ORDER BY d.name SEPARATOR ' + ') AS document_name, r.admin_message
		 FROM request_status_history h
		 LEFT JOIN requests r ON h.request_id = r.request_id
		 LEFT JOIN request_items ri ON ri.request_id = r.request_id
		 LEFT JOIN documents d ON ri.document_id = d.document_id
		 WHERE r.student_id = ? OR (h.request_id IS NULL AND h.notification_user_id = ?)
		 GROUP BY h.history_id, h.request_id, h.new_status, h.old_status, h.changed_at, h.student_read, r.admin_message
		 ORDER BY h.changed_at DESC`,
		[userId, userId]
	);

	return { history: history as Record<string, unknown>[] };
};
