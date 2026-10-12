import { formatName } from '$lib/formatting';
import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';
import { fetchOneRequestRequirements } from '$lib/server/requirements';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { fetchRequestItems, documentNameSummary } from '$lib/server/request-items';

export const load: PageServerLoad = async ({ cookies, params }) => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/login');
	try {
		const p = (await verifySession(token, JWT_SECRET));
		if (p.role === 'Student') redirect(302, '/student/dashboard');
	} catch { redirect(302, '/login'); }

	const [rows] = await pool.execute(
		`SELECT r.request_id, r.purpose, r.status,
		        r.admin_message, r.approved_file_path, r.approved_file_name,
		        r.date_requested, r.document_id, r.decided_by, r.decided_at,
		        TRIM(CONCAT_WS(' ', decider.first_name, decider.middle_name, decider.last_name, decider.suffix)) AS live_decider_name,
		        decider.role AS live_decider_role,
		        decision_log.id AS decision_log_id, decision_log.action AS decision_action,
		        decision_log.actor_name AS logged_decider_name, decision_log.actor_role AS logged_decider_role,
		        u.user_id AS student_user_id,
		        u.first_name, u.middle_name, u.last_name,
		        u.student_id AS student_code, u.program, u.student_type,
		        u.email AS student_email, u.last_school_year
		 FROM requests r
		 JOIN users u ON r.student_id = u.user_id
		 LEFT JOIN users decider ON decider.user_id = r.decided_by
		 LEFT JOIN activity_log decision_log ON decision_log.id = (
		   SELECT al.id
		   FROM activity_log al
		   WHERE al.entity_type = 'request'
		     AND al.entity_id = r.request_id
		     AND al.action IN ('request.approved', 'request.rejected', 'request.correction_requested')
		     AND r.decided_at IS NOT NULL
		     AND ABS(TIMESTAMPDIFF(SECOND, al.created_at, r.decided_at)) <= 30
		     AND JSON_CONTAINS(al.details, JSON_QUOTE('decided_by'), '$.changedFields')
		     AND JSON_CONTAINS(al.details, JSON_QUOTE('decided_at'), '$.changedFields')
		   ORDER BY al.created_at DESC, al.id DESC
		   LIMIT 1
		 )
		 WHERE r.request_id = ?`,
		[params.request_id]
	);

	const list = rows as Record<string, unknown>[];
	if (list.length === 0) error(404, 'Request not found');

	const [histRows] = await pool.execute(
		`SELECT h.old_status, h.new_status, h.changed_at,
		        h.changed_by, u.first_name, u.middle_name, u.last_name, u.role,
		        activity.actor_name AS logged_actor_name, activity.actor_role AS logged_actor_role
		 FROM request_status_history h
		 LEFT JOIN users u ON h.changed_by = u.user_id
		 LEFT JOIN activity_log activity ON activity.id = (
		   SELECT al.id
		   FROM activity_log al
		   WHERE al.entity_type = 'request'
		     AND al.entity_id = h.request_id
		     AND al.action IN ('request.submitted', 'request.approved', 'request.rejected', 'request.correction_requested', 'request.files_replaced', 'request.released', 'request.ready_for_pickup')
		     AND ABS(TIMESTAMPDIFF(SECOND, al.created_at, h.changed_at)) <= 30
		     AND (h.changed_by IS NULL OR al.actor_user_id = h.changed_by OR al.actor_user_id IS NULL)
		   ORDER BY ABS(TIMESTAMPDIFF(SECOND, al.created_at, h.changed_at)), al.created_at DESC, al.id DESC
		   LIMIT 1
		 )
		 WHERE h.request_id = ?
		 ORDER BY h.changed_at ASC`,
		[params.request_id]
	);

	const req = list[0];
	req.student_name = formatName(req.first_name, req.middle_name, req.last_name);
	req.decision_recorded = !!req.decided_at && !!req.decision_log_id;
	req.decision_actor_name = req.decision_recorded
		? String(req.live_decider_name || req.logged_decider_name || '').trim() || 'Former staff'
		: null;
	req.decision_actor_role = req.live_decider_role || req.logged_decider_role || (req.decision_recorded ? 'Staff' : null);
	const items = (await fetchRequestItems([req.request_id as string])).get(req.request_id as string) ?? [];
	req.items = items; req.document_name = documentNameSummary(items);
	const requirements = await fetchOneRequestRequirements(req.request_id as string);

	return {
		request: { ...req, items, requirements },
		history: (histRows as Record<string, unknown>[]).map(row => ({
			...row,
			changed_by_name: formatName(row.first_name, row.middle_name, row.last_name) || String(row.logged_actor_name || '').trim() || (row.changed_by ? 'Former staff' : 'Not recorded'),
			changed_by_role: row.role || row.logged_actor_role || null
		}))
	};
};
