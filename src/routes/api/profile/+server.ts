import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const PATCH: RequestHandler = async ({ request, cookies }) => {
	const token = cookies.get('session');
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	let payload: { userId: number; role: string };
	try {
		payload = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
	} catch {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

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

		await pool.execute('UPDATE users SET email = ? WHERE user_id = ?', [newEmail, payload.userId]);

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
		await pool.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, payload.userId]);

		return json({ success: true });
	}

	if (body.type === 'academic') {
		const { program, studentType, lastSchoolYear } = body;
		if (!program || !studentType || !lastSchoolYear) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const validTypes = ['Enrolled', 'Supplemental', 'Former', 'Alumni'];
		if (!validTypes.includes(studentType)) {
			return json({ error: 'Invalid student type' }, { status: 400 });
		}

		await pool.execute(
			'UPDATE users SET program = ?, student_type = ?, last_school_year = ? WHERE user_id = ?',
			[program, studentType, Number(lastSchoolYear), payload.userId]
		);

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
