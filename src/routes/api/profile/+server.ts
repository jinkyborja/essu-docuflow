import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { validateSchoolYear } from '$lib/school-year';

export const GET: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
	let payload: { userId: number; role: string };
	try { payload = (await verifySession(token, JWT_SECRET)); } catch { return json({ error: 'Unauthorized' }, { status: 401 }); }
	if (!['Student', 'Staff', 'Admin'].includes(payload.role)) return json({ error: 'Forbidden' }, { status: 403 });
	const [rows] = await pool.execute('SELECT user_id, first_name, middle_name, last_name, date_of_birth, email, student_id, program, student_type, last_school_year, id_status, id_verified_at, id_reject_reason FROM users WHERE user_id = ?', [payload.userId]);
	const profile = (rows as Record<string, unknown>[])[0];
	if (!profile) return json({ error: 'Profile not found' }, { status: 404 });
	return json(profile);
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

	if (!['Student', 'Staff', 'Admin'].includes(payload.role)) return json({ error: 'Forbidden' }, { status: 403 });
	const body = await request.json();

	if (body.type === 'personal') {
		const { firstName, middleName, lastName, suffix, dateOfBirth } = body;
		if (!firstName || !lastName || !dateOfBirth) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		await pool.execute(
			`UPDATE users SET first_name = ?, middle_name = ?, last_name = ?, suffix = ?,
			 date_of_birth = ? WHERE user_id = ?`,
			[firstName, middleName || null, lastName, suffix || null, dateOfBirth, payload.userId]
		);

		return json({ success: true });
	}

	if (body.type === 'email') {
		const { newEmail, password } = body;
		if (!newEmail || !password) {
			return json({ error: 'Missing fields' }, { status: 400 });
		}

		// Verify password
		const passwordHash = createHash('sha256').update(password).digest('hex');
		const [authRows] = await pool.execute(
			'SELECT user_id FROM users WHERE user_id = ? AND password_hash = ?',
			[payload.userId, passwordHash]
		);
		if ((authRows as unknown[]).length === 0) {
			return json({ error: 'Incorrect password' }, { status: 400 });
		}

		// Check email uniqueness
		const [existing] = await pool.execute(
			'SELECT user_id FROM users WHERE email = ? AND user_id != ?',
			[newEmail, payload.userId]
		);
		if ((existing as unknown[]).length > 0) {
			return json({ error: 'Email is already in use by another account' }, { status: 409 });
		}

		await pool.execute('UPDATE users SET email = ?, auth_version = auth_version + 1 WHERE user_id = ?', [newEmail, payload.userId]);

		return json({ success: true });
	}

	if (body.type === 'password') {
		const { currentPassword, newPassword } = body;
		if (!currentPassword || !newPassword) {
			return json({ error: 'Missing fields' }, { status: 400 });
		}
		if (newPassword.length < 8) {
			return json({ error: 'Password must be at least 8 characters' }, { status: 400 });
		}

		const currentHash = createHash('sha256').update(currentPassword).digest('hex');
		const [rows] = await pool.execute(
			'SELECT password_hash FROM users WHERE user_id = ? AND password_hash = ?',
			[payload.userId, currentHash]
		);
		if ((rows as unknown[]).length === 0) {
			return json({ error: 'Current password is incorrect' }, { status: 400 });
		}

		const newHash = createHash('sha256').update(newPassword).digest('hex');
		await pool.execute('UPDATE users SET password_hash = ?, auth_version = auth_version + 1 WHERE user_id = ?', [newHash, payload.userId]);

		return json({ success: true });
	}

	if (body.type === 'academic') {
		if (payload.role !== 'Student') return json({ error: 'Forbidden' }, { status: 403 });
		const { program, studentType, lastSchoolYear, studentId } = body;
		if (!program || !studentType || !lastSchoolYear) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const validTypes = ['Enrolled', 'Former', 'Alumni'];
		if (!validTypes.includes(studentType)) {
			return json({ error: 'Invalid student type' }, { status: 400 });
		}
		const yearError = validateSchoolYear(lastSchoolYear, studentType);
		if (yearError) return json({ error: yearError }, { status: 400 });
		if (studentId !== undefined && (typeof studentId !== 'string' || !studentId.trim() || studentId.trim().length > 20)) {
			return json({ error: 'Student ID is required and must be 20 characters or fewer.' }, { status: 400 });
		}

		try {
			// Keep the verification guard in the write itself, including concurrent verification.
			const [result] = await pool.execute(
				`UPDATE users SET student_id = COALESCE(?, student_id), program = ?, student_type = ?, last_school_year = ?
				 WHERE user_id = ? AND role = 'Student' AND id_status IN ('pending', 'rejected')`,
				[studentId?.trim() ?? null, program, studentType, Number(lastSchoolYear), payload.userId]
			);
			if ((result as { affectedRows: number }).affectedRows === 0) {
				return json({ error: 'Contact the Graduate School office to change these.' }, { status: 403 });
			}
		} catch (error) {
			if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return json({ error: 'This Student ID is already in use.' }, { status: 409 });
			throw error;
		}

		return json({ success: true });
	}

	if (body.type === 'staff-personal') {
		if (payload.role === 'Student') return json({ error: 'Forbidden' }, { status: 403 });
		const { firstName, middleName, lastName } = body;
		if (!firstName || !lastName) return json({ error: 'Missing required fields' }, { status: 400 });

		await pool.execute(
			'UPDATE users SET first_name = ?, middle_name = ?, last_name = ? WHERE user_id = ?',
			[firstName, middleName || null, lastName, payload.userId]
		);
		return json({ success: true });
	}

	if (body.type === 'staff-professional') {
		if (payload.role !== 'Admin') return json({ error: 'Only admins can edit professional information' }, { status: 403 });
		const { position } = body;

		await pool.execute(
			'UPDATE users SET position = ? WHERE user_id = ?',
			[position || null, payload.userId]
		);
		return json({ success: true });
	}

	return json({ error: 'Invalid request type' }, { status: 400 });
};
