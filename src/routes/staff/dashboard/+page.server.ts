import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/login');
	try {
		const p = verifyJwt<{ role: string }>(token, JWT_SECRET);
		if (p.role === 'Student') redirect(302, '/student/dashboard');
	} catch { redirect(302, '/login'); }

	const [[totalStudents], [totalRequests], [pendingRows], [approvedRows], [pendingQueue], [recentActivity]] =
		await Promise.all([
			pool.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'Student'"),
			pool.execute("SELECT COUNT(*) AS n FROM requests"),
			pool.execute("SELECT COUNT(*) AS n FROM requests WHERE status = 'Pending'"),
			pool.execute("SELECT COUNT(*) AS n FROM requests WHERE status = 'Approved'"),
			pool.execute(
				`SELECT r.request_id, r.date_requested, r.purpose,
				        d.name AS document_name,
				        u.first_name, u.last_name, u.student_id, u.program
				 FROM requests r
				 JOIN documents d ON r.document_id = d.document_id
				 JOIN users u ON r.student_id = u.user_id
				 WHERE r.status = 'Pending'
				 ORDER BY r.date_requested ASC
				 LIMIT 5`
			),
			pool.execute(
				`SELECT h.history_id, h.request_id, h.new_status, h.changed_at,
				        d.name AS document_name,
				        u.first_name, u.last_name
				 FROM request_status_history h
				 JOIN requests r ON h.request_id = r.request_id
				 JOIN documents d ON r.document_id = d.document_id
				 JOIN users u ON r.student_id = u.user_id
				 ORDER BY h.changed_at DESC
				 LIMIT 5`
			)
		]);

	const counts = {
		students: (totalStudents as Record<string, unknown>[])[0].n as number,
		requests: (totalRequests as Record<string, unknown>[])[0].n as number,
		pending:  (pendingRows   as Record<string, unknown>[])[0].n as number,
		approved: (approvedRows  as Record<string, unknown>[])[0].n as number,
	};

	return {
		counts,
		pendingQueue:   pendingQueue   as Record<string, unknown>[],
		recentActivity: recentActivity as Record<string, unknown>[]
	};
};
