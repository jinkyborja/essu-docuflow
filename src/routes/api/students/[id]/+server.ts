import { formatName } from '$lib/formatting';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { compare, type MasterlistRow } from '$lib/server/masterlist';
import { signStudentIdPhoto } from '$lib/server/student-id-photo';
export const GET: RequestHandler = async ({ cookies, params }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let actor;
	try { actor = await verifySession(token, JWT_SECRET); } catch { return json({ error: 'Unauthorized' }, { status: 401 }); }
	if (!['Admin', 'Staff'].includes(actor.role)) return json({ error: 'Forbidden' }, { status: 403 });
	const [rows] = await pool.execute(
		"SELECT u.user_id, u.first_name, u.middle_name, u.last_name, u.suffix, u.email, u.student_id, u.program, u.student_type, u.last_school_year, u.verified, u.id_status, u.id_verified_at, u.id_reject_reason, u.id_verification_note, u.date_of_birth, u.date_registered, u.id_photo_path, u.id_photo_uploaded_at, a.first_name AS verifier_first_name, a.middle_name AS verifier_middle_name, a.last_name AS verifier_last_name FROM users u LEFT JOIN users a ON a.user_id = u.id_verified_by WHERE u.user_id = ? AND u.role = 'Student'", [params.id]
	);
	const student = (rows as Record<string, unknown>[])[0];
	if (!student) return json({ error: 'Student not found' }, { status: 404 });
	student.id_verified_by_name = formatName(student.verifier_first_name, student.verifier_middle_name, student.verifier_last_name) || null;
	const [matches] = await pool.execute('SELECT * FROM enrollment_masterlist WHERE student_id = ?', [typeof student.student_id === 'string' ? student.student_id : null]);
	const { id_photo_path: photoPath, ...details } = student;
	const photoUrl = actor.role === 'Admin' && typeof photoPath === 'string' && photoPath ? await signStudentIdPhoto(photoPath) : null;
	return json({ ...details, has_id_photo: Boolean(photoPath), id_photo_url: photoUrl, campus: null, masterlistMatch: compare(student, (matches as MasterlistRow[])[0] ?? null) }, { headers: { 'Cache-Control': 'private, no-store' } });
};
