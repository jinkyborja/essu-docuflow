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

	const [[requests], [docStats]] = await Promise.all([
		pool.execute(
			`SELECT r.request_id, r.status, r.date_requested, d.name AS document_name
			 FROM requests r
			 JOIN documents d ON r.document_id = d.document_id
			 ORDER BY r.date_requested DESC`
		),
		pool.execute(
			`SELECT d.name AS document_name, COUNT(*) AS total,
			        SUM(r.status = 'Approved') AS approved,
			        SUM(r.status = 'Rejected') AS rejected
			 FROM requests r
			 JOIN documents d ON r.document_id = d.document_id
			 GROUP BY d.document_id, d.name
			 ORDER BY total DESC`
		)
	]);

	return {
		requests: requests as Record<string, unknown>[],
		docStats: docStats as Record<string, unknown>[]
	};
};
