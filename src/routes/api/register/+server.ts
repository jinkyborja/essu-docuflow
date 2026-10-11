import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { signJwt } from '$lib/server/jwt';
import { sendEmail } from '$lib/server/email';
import { JWT_SECRET } from '$env/static/private';
import { formatName } from '$lib/formatting';
import { validateSchoolYear } from '$lib/school-year';
import { isCampus } from '$lib/data/campuses';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid registration request.' }, { status: 400 });
	const { firstName, middleName, lastName, suffix, dateOfBirth, program, studentType, lastSchoolYear, password, campus } = body;
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email;
	const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : body.studentId;

	if ([firstName, lastName, dateOfBirth, email, studentId, program, studentType, password].some(value => typeof value !== 'string' || !value.trim()) || !lastSchoolYear) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}
	const yearError = validateSchoolYear(lastSchoolYear, studentType);
	if (yearError) return json({ error: yearError }, { status: 400 });

	if (!isCampus(campus)) return json({ error: 'Select your ESSU campus.' }, { status: 400 });
	if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });

	const validTypes = ['Enrolled', 'Former', 'Alumni'];
	if (!validTypes.includes(studentType)) {
		return json({ error: 'Invalid student type' }, { status: 400 });
	}

	// Same range the sign-up form enforces via min/max — repeated here because the
	// form's constraints can be bypassed by posting directly to this endpoint.
	const DOB_MIN = '1940-01-01';
	const DOB_MAX = '2008-12-31';
	if (dateOfBirth < DOB_MIN || dateOfBirth > DOB_MAX) {
		return json(
			{ error: `Date of birth must be between ${DOB_MIN.slice(0, 4)} and ${DOB_MAX.slice(0, 4)}.` },
			{ status: 400 }
		);
	}

	const passwordHash = createHash('sha256').update(password).digest('hex');
	const fullName = formatName(firstName, middleName, lastName);
	let conn: Awaited<ReturnType<typeof pool.getConnection>> | null = null;
	let transactionOpen = false;
	try {
		const [existing] = await pool.execute('SELECT user_id FROM users WHERE email = ?', [email]);
		if ((existing as unknown[]).length) return json({ error: 'Email already registered' }, { status: 409 });
		const [existingStudentId] = await pool.execute('SELECT user_id FROM users WHERE student_id = ?', [studentId]);
		if ((existingStudentId as unknown[]).length) return json({ error: 'Student ID already registered' }, { status: 409 });

		conn = await pool.getConnection();
		await conn.beginTransaction(); transactionOpen = true;
		await conn.execute(
			`INSERT INTO users (first_name, middle_name, last_name, suffix, date_of_birth, email, password_hash, role, student_id, program, student_type, last_school_year, campus, verified, id_status)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'Student', ?, ?, ?, ?, ?, FALSE, 'pending')`,
			[firstName, middleName || null, lastName, suffix || null, dateOfBirth, email, passwordHash, studentId, program, studentType, lastSchoolYear, campus]
		);
		const [admins] = await conn.execute("SELECT user_id FROM users WHERE role = 'Admin'");
		for (const admin of admins as Array<{ user_id: number }>) {
			await conn.execute(
				`INSERT INTO request_status_history (request_id, old_status, new_status, changed_by, notification_user_id, is_read, student_read)
				 VALUES (NULL, NULL, ?, NULL, ?, FALSE, TRUE)`,
				['New student awaiting ID verification', admin.user_id]
			);
		}
		await conn.commit(); transactionOpen = false;
	} catch (error) {
		if (conn && transactionOpen) await conn.rollback();
		console.error('Registration failed:', error);
		if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return json({ error: 'This email or Student ID is already registered.' }, { status: 409 });
		return json({ error: 'Could not create your account. Please try again.' }, { status: 500 });
	} finally {
		conn?.release();
	}

	const token = signJwt({ email, purpose: 'email-verification' }, JWT_SECRET, 86400);
	const verifyUrl = `${new URL(request.url).origin}/api/verify?token=${token}`;

	try {
		await sendEmail({
			to: email,
			subject: 'Verify your ESSU DocuFlow account',
			html: `
				<p>Dear ${fullName},</p>
				<p>Please verify your ESSU DocuFlow account by clicking the link below:</p>
				<p><a href="${verifyUrl}">Verify your email address</a></p>
				<p>This link expires in 24 hours.</p>
				<p>ESSU DocuFlow — Graduate School</p>`
		});
	} catch (emailError) {
		console.error('Email error:', emailError);
		return json(
			{ error: 'Your account was created, but the verification email could not be sent. Please contact the Graduate School office for help.', accountCreated: true },
			{ status: 502 }
		);
	}

	return json({ success: true, message: 'Verification email sent. Please check your inbox.' });
};
