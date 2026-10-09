import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { fetchRequestItems, documentNameSummary } from '$lib/server/request-items';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/login');
	try {
		const p = (await verifySession(token, JWT_SECRET));
		if (p.role === 'Student') redirect(302, '/student/dashboard');
	} catch { redirect(302, '/login'); }

	const [[totalStudents], [totalRequests], [pendingRows], [approvedRows], [pendingIds], [pendingQueue], [recentActivity]] =
		await Promise.all([
			pool.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'Student'"),
			pool.execute("SELECT COUNT(*) AS n FROM requests"),
			pool.execute("SELECT COUNT(*) AS n FROM requests WHERE status = 'Pending'"),
			pool.execute("SELECT COUNT(*) AS n FROM requests WHERE status = 'Approved'"),
			pool.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'Student' AND id_status = 'pending'"),
			pool.execute(
				`SELECT r.request_id, r.date_requested, r.purpose,
				        u.first_name, u.last_name, u.student_id, u.program
				 FROM requests r
				 JOIN users u ON r.student_id = u.user_id
				 WHERE r.status = 'Pending'
				 ORDER BY r.date_requested ASC
				 LIMIT 5`
			),
			pool.execute(
				`SELECT h.history_id, h.request_id, h.new_status, h.changed_at,
				        GROUP_CONCAT(DISTINCT d.name ORDER BY d.name SEPARATOR ' + ') AS document_name,
				        u.first_name, u.last_name
				 FROM request_status_history h
				 JOIN requests r ON h.request_id = r.request_id
				 JOIN request_items ri ON ri.request_id = r.request_id
				 JOIN documents d ON ri.document_id = d.document_id
				 JOIN users u ON r.student_id = u.user_id
				 GROUP BY h.history_id, h.request_id, h.new_status, h.changed_at, u.first_name, u.last_name
				 ORDER BY h.changed_at DESC
				 LIMIT 5`
			)
		]);
	const queueRows = pendingQueue as Array<Record<string, unknown>>;
	const queueItems = await fetchRequestItems(queueRows.map((r) => r.request_id as string));
	for (const row of queueRows) { row.items = queueItems.get(row.request_id as string) ?? []; row.document_name = documentNameSummary(row.items as Array<{document_id:number;name:string}>); }

	const [[deliveryRows], [correctionRows]] = await Promise.all([
		pool.execute("SELECT COUNT(*) AS n FROM requests r WHERE r.status = 'Approved' AND NOT EXISTS (SELECT 1 FROM request_status_history h WHERE h.request_id = r.request_id AND h.new_status = 'Completed')"),
		pool.execute("SELECT COUNT(*) AS n FROM requests WHERE status = 'Correction Requested'")
	]);
	const counts = {
		awaitingDelivery: Number((deliveryRows as Array<{n:number}>)[0].n),
		awaitingCorrections: Number((correctionRows as Array<{n:number}>)[0].n),
		students: (totalStudents as Record<string, unknown>[])[0].n as number,
		requests: (totalRequests as Record<string, unknown>[])[0].n as number,
		pending:  (pendingRows   as Record<string, unknown>[])[0].n as number,
		approved: (approvedRows  as Record<string, unknown>[])[0].n as number,
		pendingVerification: (pendingIds as Record<string, unknown>[])[0].n as number,
	};

	return {
		role: (await verifySession(token, JWT_SECRET)).role,
		counts,
		pendingQueue:   queueRows,
		recentActivity: recentActivity as Record<string, unknown>[]
	};
};
