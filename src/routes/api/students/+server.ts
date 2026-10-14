import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { validateSchoolYear } from '$lib/school-year';
import { isCampus } from '$lib/data/campuses';
import { logActivitySafely } from '$lib/server/activity-log';

export const GET: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (payload.role === 'Student') return json({ error: 'Forbidden' }, { status: 403 });

	const [rows] = await pool.execute(
		`SELECT user_id, first_name, middle_name, last_name, suffix, email,
		        student_id, program, campus, student_type, last_school_year, verified, id_status, id_verified_at, id_reject_reason, date_of_birth, date_registered
		 FROM users
		 WHERE role = 'Student'
		 ORDER BY last_name ASC`
	);

	return json(rows);
};

export const PATCH: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!['Staff', 'Admin'].includes(payload.role)) return json({ error: 'Forbidden' }, { status: 403 });

	const body = await request.json();
	const {
		user_id, first_name, middle_name, last_name, suffix,
		email, student_id, program, campus, student_type, last_school_year, verified
	} = body;
	const validTypes = ['Enrolled', 'Former', 'Alumni'];
	if (student_type != null && !validTypes.includes(student_type)) {
		return json({ error: 'Invalid student type' }, { status: 400 });
	}
	const yearError = validateSchoolYear(last_school_year, student_type);
	if (yearError) return json({ error: yearError }, { status: 400 });
	if (campus != null && !isCampus(campus)) return json({ error: 'Select an ESSU campus.' }, { status: 400 });

	const [existingRows] = await pool.execute('SELECT first_name, middle_name, last_name, suffix, email, student_id, program, student_type, last_school_year, verified, campus FROM users WHERE user_id = ? AND role = \'Student\'', [user_id]);
	const existingStudent = (existingRows as Array<Record<string, unknown>>)[0];
	await pool.execute(
		`UPDATE users
		 SET first_name = ?, middle_name = ?, last_name = ?, suffix = ?,
		     email = ?, student_id = ?, program = ?, student_type = ?,
		     last_school_year = ?, verified = ?, campus = IF(?, ?, campus)
		 WHERE user_id = ? AND role = 'Student'`,
		[first_name, middle_name ?? null, last_name, suffix ?? null,
		 email, student_id ?? null, program ?? null, student_type ?? null,
		 last_school_year ?? null, verified ? 1 : 0, campus !== undefined, campus ?? null, user_id]
	);
	const nextStudent = { first_name, middle_name: middle_name ?? null, last_name, suffix: suffix ?? null, email, student_id: student_id ?? null, program: program ?? null, student_type: student_type ?? null, last_school_year: last_school_year ?? null, verified: verified ? 1 : 0, campus: campus ?? existingStudent?.campus };
	const changedFields = existingStudent
		? Object.keys(nextStudent).filter(field => (campus !== undefined || field !== 'campus') && String(existingStudent[field] ?? '') !== String(nextStudent[field as keyof typeof nextStudent] ?? ''))
		: [];
	if (existingStudent && changedFields.length) {
		try {
			const conn = await pool.getConnection();
			try {
				await logActivitySafely(conn, { actor: payload, action: 'student.edited', entityType: 'student', entityId: user_id, summary: `Updated student #${user_id}`, details: { changedFields } });
				if (changedFields.includes('email')) await logActivitySafely(conn, { actor: payload, action: 'account.email.changed', entityType: 'student', entityId: user_id, summary: `Updated email for student #${user_id}`, details: { changedFields: ['email'] } });
			} finally { conn.release(); }
		} catch (error) { console.error('Could not write student edit activity:', error); }
	}

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token, JWT_SECRET));
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// The UI only offers this to admins; enforce it here too.
	if (payload.role !== 'Admin') return json({ error: 'Admin access required' }, { status: 403 });

	const { user_id } = await request.json();
	if (!user_id) return json({ error: 'Missing user_id' }, { status: 400 });

	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		const [lockedRows] = await conn.execute("SELECT user_id FROM users WHERE user_id = ? AND role = 'Student' FOR UPDATE", [user_id]);
		if ((lockedRows as unknown[]).length === 0) {
			await conn.rollback();
			return json({ error: 'Student not found' }, { status: 404 });
		}
		const [requestRows] = await conn.execute(
			'SELECT request_id FROM requests WHERE student_id = ? FOR UPDATE',
			[user_id]
		);
		if ((requestRows as unknown[]).length > 0) {
			await conn.rollback();
			return json({
				error: 'This student has requests on record and cannot be deleted. Their history must stay intact.'
			}, { status: 409 });
		}

		const [historyRows] = await conn.execute(
			'SELECT history_id FROM request_status_history WHERE changed_by = ? OR notification_user_id = ? LIMIT 1',
			[user_id, user_id]
		);
		if ((historyRows as unknown[]).length > 0) {
			await conn.rollback();
			return json({
				error: 'This student has activity history that must be retained and cannot be deleted.'
			}, { status: 409 });
		}
		await logActivitySafely(conn, {
			actor: payload,
			action: 'student.deleted',
			entityType: 'student',
			entityId: user_id,
			summary: `Deleted student #${user_id}`,
			details: { changedFields: ['student account'] }
		});
		await conn.execute(`DELETE FROM users WHERE user_id = ? AND role = 'Student'`, [user_id]);
		await conn.commit();
	} catch (err) {
		try {
			await conn.rollback();
		} catch (rollbackError) {
			console.error('Student delete rollback failed:', rollbackError);
		}
		console.error('Student delete failed:', err);
		return json({ error: 'Could not delete student. Please try again.' }, { status: 500 });
	} finally {
		conn.release();
	}
	return json({ success: true });
};
