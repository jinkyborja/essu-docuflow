import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { logActivitySafely } from '$lib/server/activity-log';
import { archiveReason, cancellationReason, type LifecycleRequest } from '$lib/request-lifecycle';

export const POST: RequestHandler = async ({ cookies, request, params }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let actor;
	try { actor = await verifySession(token, JWT_SECRET); }
	catch { return json({ error: 'Unauthorized' }, { status: 401 }); }
	if (actor.role !== 'Admin') return json({ error: 'Admin access required' }, { status: 403 });
	const body = await request.json().catch(() => null);
	if (!body || !['cancel', 'archive'].includes(body.action) || body.confirm !== true) return json({ error: 'Confirm a valid request action.' }, { status: 400 });
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		const [rows] = await conn.execute('SELECT status, archived_at FROM requests WHERE request_id = ? FOR UPDATE', [params.id]);
		const row = (rows as LifecycleRequest[])[0];
		if (!row) { await conn.rollback(); return json({ error: 'Request not found' }, { status: 404 }); }
		const [history] = await conn.execute('SELECT new_status FROM request_status_history WHERE request_id = ?', [params.id]);
		row.history = history as Array<{ new_status: string }>;
		const reason = body.action === 'cancel' ? cancellationReason(row) : archiveReason(row);
		if (reason) { await conn.rollback(); return json({ error: reason }, { status: 409 }); }
		if (body.action === 'cancel') {
			await conn.execute("UPDATE requests SET status = 'Cancelled' WHERE request_id = ?", [params.id]);
			await conn.execute('INSERT INTO request_status_history (request_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)', [params.id, row.status, 'Cancelled', actor.userId]);
		} else {
			// Archive metadata never replaces the original status, files or history.
			await conn.execute('UPDATE requests SET archived_at = CURRENT_TIMESTAMP, archived_by = ? WHERE request_id = ?', [actor.userId, params.id]);
		}
		await logActivitySafely(conn, { actor, action: body.action === 'cancel' ? 'request.cancelled' : 'request.archived', entityType: 'request', entityId: params.id,
			summary: `${body.action === 'cancel' ? 'Cancelled' : 'Archived'} request ${params.id}`,
			details: { changedFields: body.action === 'cancel' ? ['status'] : ['archived_at', 'archived_by'] } });
		await conn.commit();
		return json({ success: true, request_id: params.id, status: body.action === 'cancel' ? 'Cancelled' : row.status, archived: body.action === 'archive' });
	} catch (error) {
		await conn.rollback(); console.error('Request lifecycle update failed:', error);
		return json({ error: 'Could not update the request. Please try again.' }, { status: 500 });
	} finally { conn.release(); }
};
