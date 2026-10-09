import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { requireMasterlistAdmin } from '$lib/server/masterlist';
export const DELETE: RequestHandler = async ({ cookies, params }) => {
	await requireMasterlistAdmin(cookies);
	if (!/^\d+$/.test(params.id) || !Number.isSafeInteger(Number(params.id)) || Number(params.id) < 1) return json({ error: 'Invalid row ID' }, { status: 400 });
	const [result] = await pool.execute('DELETE FROM enrollment_masterlist WHERE id = ?', [params.id]);
	return (result as { affectedRows: number }).affectedRows ? json({ success: true }) : json({ error: 'Row not found' }, { status: 404 });
};
