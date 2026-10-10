import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request, cookies, params }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let actor: { userId: number; role: string };
	try { actor = (await verifySession(token, JWT_SECRET)); } catch { return json({ error: 'Unauthorized' }, { status: 401 }); }
	if (actor.role !== 'Admin') return json({ error: 'Admin access required' }, { status: 403 });
	const body = await request.json().catch(() => ({}));
	if (!body || typeof body !== 'object' || !['verify', 'reject', 'revoke'].includes(body.action)) return json({ error: 'Action must be verify, reject or revoke' }, { status: 400 });
	const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
	if (['reject', 'revoke'].includes(body.action) && !reason) return json({ error: 'A reason is required to reject or revoke student ID verification.' }, { status: 400 });
	if (reason.length > 300) return json({ error: 'Reason must be 300 characters or fewer.' }, { status: 400 });
	const note = typeof body.note === 'string' ? body.note.trim() : '';
	if (note.length > 300) return json({ error: 'Note must be 300 characters or fewer.' }, { status: 400 });
	if (body.action === 'revoke' && body.confirm !== true) return json({ error: 'Confirm revocation first.' }, { status: 400 });
	const status = body.action === 'verify' ? 'verified' : 'rejected';
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		const [rows] = await conn.execute("SELECT user_id, student_id, id_status, id_photo_path FROM users WHERE user_id = ? AND role = 'Student' FOR UPDATE", [params.id]);
		const student = (rows as Array<{ user_id: number; student_id: string | null; id_status: string; id_photo_path: string | null }>)[0];
		if (!student) { await conn.rollback(); return json({ error: 'Student not found' }, { status: 404 }); }
		if ((body.action === 'revoke' && student.id_status !== 'verified') || (body.action !== 'revoke' && student.id_status === 'verified')) {
			await conn.rollback(); return json({ error: 'Student status changed. Reopen the review; revoke verification before deciding again.' }, { status: 409 });
		}
		let storedNote: string | null = null;
		if (body.action === 'verify') {
			if (!student.id_photo_path) { await conn.rollback(); return json({ error: 'A school ID photo must be uploaded before verification.' }, { status: 400 }); }
			const [matches] = await conn.execute('SELECT id FROM enrollment_masterlist WHERE student_id = ? FOR UPDATE', [student.student_id]);
			if (!(matches as unknown[]).length) {
				if (body.verifyAnyway !== true || !note) { await conn.rollback(); return json({ error: 'Student ID is not in the masterlist. Confirm Verify anyway and provide a short note.' }, { status: 400 }); }
				storedNote = note;
			}
		}
		await conn.execute('UPDATE users SET id_status = ?, id_verified_by = ?, id_verified_at = CURRENT_TIMESTAMP, id_reject_reason = ?, id_verification_note = ? WHERE user_id = ?', [status, actor.userId, status === 'rejected' ? reason : null, storedNote, student.user_id]);
		// Notification history uses the existing request status history stream.
		await conn.execute('INSERT INTO request_status_history (request_id, old_status, new_status, changed_by, notification_user_id, is_read, student_read) VALUES (NULL, NULL, ?, ?, ?, TRUE, FALSE)', [body.action === 'revoke' ? 'Your student ID verification was revoked' : status === 'verified' ? 'Your student ID was verified' : 'Your student ID was rejected', actor.userId, student.user_id]);
		await conn.commit();
		return json({ success: true, id_status: status, id_verified_at: new Date().toISOString(), id_reject_reason: status === 'rejected' ? reason : null, id_verification_note: storedNote });
	} catch (error) { await conn.rollback(); console.error('Student ID verification failed:', error); return json({ error: 'Could not update student verification.' }, { status: 500 }); }
	finally { conn.release(); }
};
