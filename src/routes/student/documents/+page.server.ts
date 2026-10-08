import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';
import { fetchRequestRequirements } from '$lib/server/requirements';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { fetchRequestItems, documentNameSummary } from '$lib/server/request-items';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/login');

	let payload: { userId: number; role: string };
	try {
		payload = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
	} catch { redirect(302, '/login'); }
	if (payload!.role !== 'Student') redirect(302, '/staff/dashboard');

	const [rows] = await pool.execute(
		`SELECT r.request_id, r.purpose, r.status,
		        r.admin_message, r.approved_file_path, r.approved_file_name,
		        r.date_requested
		 FROM requests r
		 WHERE r.student_id = ?
		 ORDER BY r.date_requested DESC`,
		[payload!.userId]
	);

	const reqs = rows as Record<string, unknown>[];
	const itemMap = await fetchRequestItems(reqs.map((r) => r.request_id as string));
	for (const row of reqs) { row.items = itemMap.get(row.request_id as string) ?? []; row.document_name = documentNameSummary(row.items as Array<{document_id:number;name:string}>); }
	const reqMap = await fetchRequestRequirements(reqs.map((r) => r.request_id as string));
	for (const r of reqs) r.requirements = reqMap.get(r.request_id as string) ?? [];

	return { requests: reqs };
};
