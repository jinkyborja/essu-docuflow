import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ResultSetHeader } from 'mysql2';
import pool from '$lib/server/db';
import { requireMasterlistAdmin } from '$lib/server/masterlist';
import { logActivitySafely } from '$lib/server/activity-log';
export const GET: RequestHandler = async ({ cookies, url }) => {
	await requireMasterlistAdmin(cookies);
	const page = Number(url.searchParams.get('page') ?? 1), limit = Number(url.searchParams.get('limit') ?? 20);
	if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) return json({ error: 'Invalid pagination' }, { status: 400 });
	const q = (url.searchParams.get('search') ?? '').trim().slice(0, 200);
	const pattern = '%' + q + '%';
	const where = 'WHERE student_id LIKE ? OR last_name LIKE ? OR first_name LIKE ? OR program LIKE ? OR campus LIKE ?';
	const args = Array(5).fill(pattern);
	const [counts] = await pool.execute('SELECT COUNT(*) AS total FROM enrollment_masterlist ' + where, args);
	const offset = (page - 1) * limit;
	const [rows] = await pool.execute('SELECT * FROM enrollment_masterlist ' + where + ` ORDER BY last_name, first_name, id LIMIT ${limit} OFFSET ${offset}`, args);
	return json({ rows, total: Number((counts as Array<{total: number}>)[0].total), page, limit });
};

export const DELETE: RequestHandler = async ({ cookies, request }) => {
	const actor = await requireMasterlistAdmin(cookies);
	const body = await request.json().catch(() => null);
	if (body?.confirm !== true) return json({ error: 'Confirm deletion of all masterlist entries.' }, { status: 400 });
	try {
		const [result] = await pool.execute('DELETE FROM enrollment_masterlist');
		const deleted = (result as ResultSetHeader).affectedRows;
		try {
			const conn = await pool.getConnection();
			try { await logActivitySafely(conn, { actor, action: 'masterlist.cleared', entityType: 'masterlist', entityId: null, summary: `Cleared ${deleted} masterlist entries`, details: { changedFields: ['masterlist entries'] } }); }
			finally { conn.release(); }
		} catch (error) { console.error('Could not write masterlist clear activity:', error); }
		return json({ success: true, deleted });
	} catch (err) {
		console.error('Could not clear enrollment masterlist:', err);
		return json({ error: 'Could not delete masterlist entries. Please try again.' }, { status: 500 });
	}
};
