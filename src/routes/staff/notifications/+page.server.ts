import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';

export const load: PageServerLoad = async ({ parent }) => {
	const { role } = await parent();
	if (role === 'Student') redirect(302, '/student/dashboard');

	// New unreviewed requests (pending, no history yet)
	const [newRequests] = await pool.execute(
		`SELECT r.request_id, r.date_requested, r.staff_viewed,
		        u.first_name, u.last_name
		 FROM requests r
		 JOIN users u ON r.student_id = u.user_id
		 WHERE r.status = 'Pending'
		   AND NOT EXISTS (SELECT 1 FROM request_status_history h WHERE h.request_id = r.request_id)
		 ORDER BY r.date_requested DESC`
	);

	// All status history entries
	const [history] = await pool.execute(
		`SELECT h.history_id, h.request_id, h.new_status, h.old_status, h.changed_at, h.is_read,
	        GROUP_CONCAT(DISTINCT d.name ORDER BY d.name SEPARATOR ' + ') AS document_name, u.first_name, u.last_name, r.admin_message
		 FROM request_status_history h
		 LEFT JOIN requests r ON h.request_id = r.request_id
		 LEFT JOIN request_items ri ON ri.request_id = r.request_id
		 LEFT JOIN documents d ON ri.document_id = d.document_id
		 LEFT JOIN users u ON r.student_id = u.user_id
		 WHERE r.request_id IS NOT NULL OR (h.request_id IS NULL AND h.notification_user_id IN (SELECT user_id FROM users WHERE role = 'Admin'))
		 GROUP BY h.history_id, h.request_id, h.new_status, h.old_status, h.changed_at, h.is_read, u.first_name, u.last_name, r.admin_message
		 ORDER BY h.changed_at DESC`
	);

	return {
		newRequests: newRequests as Record<string, unknown>[],
		history: history as Record<string, unknown>[]
	};
};
