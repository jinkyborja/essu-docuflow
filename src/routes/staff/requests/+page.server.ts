import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { fetchRequestItems, documentNameSummary } from '$lib/server/request-items';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/login');
	try {
		const p = verifyJwt<{ role: string }>(token, JWT_SECRET);
		if (p.role === 'Student') redirect(302, '/student/dashboard');
	} catch { redirect(302, '/login'); }

	const [rows] = await pool.execute(
		`SELECT r.request_id,
		        CONCAT(u.first_name, IF(u.middle_name IS NOT NULL, CONCAT(' ', u.middle_name), ''), ' ', u.last_name) AS student_name,
		        u.student_id AS student_code, u.program,
		        r.status, r.purpose, r.date_requested
		 FROM requests r
		 JOIN users u ON r.student_id = u.user_id
		 ORDER BY r.date_requested DESC`
	);

	const requests = rows as Array<Record<string, unknown>>;
	const itemMap = await fetchRequestItems(requests.map((r) => r.request_id as string));
	for (const row of requests) { row.items = itemMap.get(row.request_id as string) ?? []; row.document_name = documentNameSummary(row.items as Array<{document_id:number;name:string}>); }
	return { requests };
};
