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

	const [requests] = await pool.execute(
		`SELECT r.request_id, r.status, r.date_requested
		 FROM requests r
		 ORDER BY r.date_requested DESC`
	);
	const requestRows = requests as Array<Record<string, unknown>>;
	const itemMap = await fetchRequestItems(requestRows.map((r) => r.request_id as string));
	for (const row of requestRows) { row.items = itemMap.get(row.request_id as string) ?? []; row.document_name = documentNameSummary(row.items as Array<{document_id:number;name:string}>); }

	return {
		requests: requestRows
	};
};
