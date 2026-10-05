import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	try { verifyJwt(token, JWT_SECRET); } catch { return json({ error: 'Unauthorized' }, { status: 401 }); }

	const { type, ids } = await request.json();
	if (!type || !Array.isArray(ids) || ids.length === 0) return json({ ok: true });

	if (type === 'history') {
		const placeholders = ids.map(() => '?').join(',');
		await pool.execute(
			`UPDATE request_status_history SET is_read = TRUE WHERE history_id IN (${placeholders})`,
			ids
		);
	} else if (type === 'student-history') {
		const placeholders = ids.map(() => '?').join(',');
		await pool.execute(
			`UPDATE request_status_history SET student_read = TRUE WHERE history_id IN (${placeholders})`,
			ids
		);
	} else if (type === 'request') {
		const placeholders = ids.map(() => '?').join(',');
		await pool.execute(
			`UPDATE requests SET staff_viewed = TRUE WHERE request_id IN (${placeholders})`,
			ids
		);
	}

	return json({ ok: true });
};
