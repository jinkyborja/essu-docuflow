import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { requireMasterlistAdmin } from '$lib/server/masterlist';
import { logActivitySafely } from '$lib/server/activity-log';
export const DELETE: RequestHandler = async ({ cookies, params }) => {
	const actor = await requireMasterlistAdmin(cookies);
	if (!/^\d+$/.test(params.id) || !Number.isSafeInteger(Number(params.id)) || Number(params.id) < 1) return json({ error: 'Invalid row ID' }, { status: 400 });
	const [result] = await pool.execute('DELETE FROM enrollment_masterlist WHERE id = ?', [params.id]);
	if (!(result as { affectedRows: number }).affectedRows) return json({ error: 'Row not found' }, { status: 404 });
	try {
		const conn = await pool.getConnection();
		try { await logActivitySafely(conn, { actor, action: 'masterlist.entry.deleted', entityType: 'masterlist', entityId: params.id, summary: `Deleted masterlist entry #${params.id}`, details: { changedFields: ['masterlist entry'] } }); }
		finally { conn.release(); }
	} catch (error) { console.error('Could not write masterlist deletion activity:', error); }
	return json({ success: true });
};
