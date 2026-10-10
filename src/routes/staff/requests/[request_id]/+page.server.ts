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
		        r.date_requested, r.document_id,
		        u.user_id AS student_user_id,
		        u.first_name, u.middle_name, u.last_name,
		        u.student_id AS student_code, u.program, u.student_type,
		        u.email AS student_email, u.last_school_year
		 FROM requests r
		 JOIN users u ON r.student_id = u.user_id
		 WHERE r.request_id = ?`,
		[params.request_id]
	);

	const list = rows as Record<string, unknown>[];
	if (list.length === 0) error(404, 'Request not found');

	const [histRows] = await pool.execute(
		`SELECT h.old_status, h.new_status, h.changed_at,
		        u.first_name, u.middle_name, u.last_name
		 FROM request_status_history h
		 LEFT JOIN users u ON h.changed_by = u.user_id
		 WHERE h.request_id = ?
		 ORDER BY h.changed_at ASC`,
		[params.request_id]
	);

	const req = list[0];
	req.student_name = formatName(req.first_name, req.middle_name, req.last_name);
	const items = (await fetchRequestItems([req.request_id as string])).get(req.request_id as string) ?? [];
	req.items = items; req.document_name = documentNameSummary(items);
	const requirements = await fetchOneRequestRequirements(req.request_id as string);

	return {
		request: { ...req, items, requirements },
		history: (histRows as Record<string, unknown>[]).map(row => ({ ...row, changed_by_name: formatName(row.first_name, row.middle_name, row.last_name) || null }))
	};
};
