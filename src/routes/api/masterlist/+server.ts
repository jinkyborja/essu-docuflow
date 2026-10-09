import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { requireMasterlistAdmin } from '$lib/server/masterlist';
export const GET: RequestHandler = async ({ cookies, url }) => {
	await requireMasterlistAdmin(cookies);
	const page = Number(url.searchParams.get('page') ?? 1), limit = Number(url.searchParams.get('limit') ?? 20);
	if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) return json({ error: 'Invalid pagination' }, { status: 400 });
	const q = (url.searchParams.get('search') ?? '').trim().slice(0, 200);
	const pattern = '%' + q + '%';
	const where = 'WHERE student_id LIKE ? OR last_name LIKE ? OR first_name LIKE ? OR program LIKE ? OR campus LIKE ?';
	const args = Array(5).fill(pattern);
	const [counts] = await pool.execute('SELECT COUNT(*) AS total FROM enrollment_masterlist ' + where, args);
	const [rows] = await pool.execute('SELECT * FROM enrollment_masterlist ' + where + ' ORDER BY last_name, first_name, id LIMIT ? OFFSET ?', [...args, String(limit), String((page - 1) * limit)]);
	return json({ rows, total: Number((counts as Array<{total: number}>)[0].total), page, limit });
};
