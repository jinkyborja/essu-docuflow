import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let actor;
	try { actor = await verifySession(token, JWT_SECRET); } catch { return json({ error: 'Unauthorized' }, { status: 401 }); }

	let body;
	try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
	const { type, ids } = body ?? {};
	if (!['history', 'student-history', 'request'].includes(type) || !Array.isArray(ids) || ids.length > 500 ||
		ids.some((id) => type === 'request' ? typeof id !== 'string' || !id.trim() || id.length > 20 : !Number.isSafeInteger(id) || id <= 0)) {
		return json({ error: 'Invalid notification type or IDs' }, { status: 400 });
	}
	if ((type === 'student-history') !== (actor.role === 'Student')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}
	if (ids.length === 0) return json({ ok: true });
	const uniqueIds = [...new Set<string | number>(ids)];
	const placeholders = uniqueIds.map(() => '?').join(',');
	const studentScope = '(r.student_id = ? OR (h.request_id IS NULL AND h.notification_user_id = ?))';
	const officeScope = "(r.request_id IS NOT NULL OR (h.request_id IS NULL AND u.role = 'Admin'))";
	const scopeArgs = type === 'student-history' ? [actor.userId, actor.userId] : [];
	const [allowedRows] = type === 'request'
		? await pool.execute(`SELECT request_id FROM requests WHERE request_id IN (${placeholders})`, uniqueIds)
		: await pool.execute(
			`SELECT h.history_id FROM request_status_history h
			 LEFT JOIN requests r ON r.request_id = h.request_id
			 LEFT JOIN users u ON u.user_id = h.notification_user_id
			 WHERE h.history_id IN (${placeholders}) AND ${type === 'student-history' ? studentScope : officeScope}`,
			[...uniqueIds, ...scopeArgs]
		);
	if ((allowedRows as unknown[]).length !== uniqueIds.length) return json({ error: 'Forbidden' }, { status: 403 });

	if (type === 'history') {
		await pool.execute(
			`UPDATE request_status_history h LEFT JOIN requests r ON r.request_id = h.request_id
			 LEFT JOIN users u ON u.user_id = h.notification_user_id
			 SET h.is_read = TRUE WHERE h.history_id IN (${placeholders}) AND ${officeScope}`,
			uniqueIds
		);
	} else if (type === 'student-history') {
		await pool.execute(
			`UPDATE request_status_history h LEFT JOIN requests r ON r.request_id = h.request_id
			 SET h.student_read = TRUE WHERE h.history_id IN (${placeholders}) AND ${studentScope}`,
			[...uniqueIds, ...scopeArgs]
		);
	} else if (type === 'request') {
		await pool.execute(
			`UPDATE requests SET staff_viewed = TRUE WHERE request_id IN (${placeholders})`,
			uniqueIds
		);
	}

	return json({ ok: true });
};
