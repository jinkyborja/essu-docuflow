import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request, cookies, params }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let actor: { userId: number; role: string };
	try { actor = verifyJwt(token, JWT_SECRET); } catch { return json({ error: 'Unauthorized' }, { status: 401 }); }
	if (actor.role !== 'Admin') return json({ error: 'Admin access required' }, { status: 403 });
	const body = await request.json().catch(() => ({}));
	if (!['verify', 'reject'].includes(body.action)) return json({ error: 'Action must be verify or reject' }, { status: 400 });
	const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
	if (body.action === 'reject' && !reason) return json({ error: 'A reason is required to reject a student.' }, { status: 400 });
	if (reason.length > 300) return json({ error: 'Reason must be 300 characters or fewer.' }, { status: 400 });
	const status = body.action === 'verify' ? 'verified' : 'rejected';
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		const [rows] = await conn.execute("SELECT user_id FROM users WHERE user_id = ? AND role = 'Student' FOR UPDATE", [params.id]);
		const student = (rows as Array<{ user_id: number }>)[0];
		if (!student) { await conn.rollback(); return json({ error: 'Student not found' }, { status: 404 }); }
		await conn.execute('UPDATE users SET id_status = ?, id_verified_by = ?, id_verified_at = CURRENT_TIMESTAMP, id_reject_reason = ? WHERE user_id = ?', [status, actor.userId, status === 'rejected' ? reason : null, student.user_id]);
		// Notification history uses the existing request status history stream.
		await conn.execute('INSERT INTO request_status_history (request_id, old_status, new_status, changed_by, notification_user_id, is_read, student_read) VALUES (NULL, NULL, ?, ?, ?, TRUE, FALSE)', [status === 'verified' ? 'Your student ID was verified' : `Your student ID could not be verified: ${reason}`, actor.userId, student.user_id]);
		await conn.commit();
		return json({ success: true, id_status: status, id_verified_at: new Date().toISOString(), id_reject_reason: status === 'rejected' ? reason : null });
	} catch (error) { await conn.rollback(); console.error('Student ID verification failed:', error); return json({ error: 'Could not update student verification.' }, { status: 500 }); }
	finally { conn.release(); }
};
