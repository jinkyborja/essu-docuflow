import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { signJwt } from '$lib/server/jwt';
import { MAIL_FROM } from '$lib/server/email';
import { JWT_SECRET, RESEND_API } from '$env/static/private';

const resend = new Resend(RESEND_API);

export const POST: RequestHandler = async ({ request }) => {
	const { firstName, middleName, lastName, suffix, dateOfBirth, email, studentId, program, studentType, lastSchoolYear, password } = await request.json();

	if (!firstName || !lastName || !dateOfBirth || !email || !studentId || !program || !studentType || !lastSchoolYear || !password) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	const [existing] = await pool.execute('SELECT user_id FROM users WHERE email = ?', [email]);
	if ((existing as unknown[]).length > 0) {
		return json({ error: 'Email already registered' }, { status: 409 });
	}

	const [existingStudentId] = await pool.execute('SELECT user_id FROM users WHERE student_id = ?', [studentId]);
	if ((existingStudentId as unknown[]).length > 0) {
		return json({ error: 'Student ID already registered' }, { status: 409 });
	}

	const passwordHash = createHash('sha256').update(password).digest('hex');
	const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');

	const validTypes = ['Enrolled', 'Supplemental', 'Former', 'Alumni'];
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

	await pool.execute(
		`INSERT INTO users (first_name, middle_name, last_name, suffix, date_of_birth, email, password_hash, role, student_id, program, student_type, last_school_year, verified)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'Student', ?, ?, ?, ?, FALSE)`,
		[firstName, middleName || null, lastName, suffix || null, dateOfBirth, email, passwordHash, studentId, program, studentType, lastSchoolYear]
	);

	const token = signJwt({ email }, JWT_SECRET, 86400);
	const verifyUrl = `${new URL(request.url).origin}/api/verify?token=${token}`;

	const { error: resendError } = await resend.emails.send({
		from: MAIL_FROM,
		to: email,
		template: {
			id: 'email-verification',
			variables: {
				full_name: fullName,
				verify_url: verifyUrl
			}
		}
	});

	if (resendError) {
		console.error('Resend error:', resendError);
		return json(
			{ error: `Account created but verification email failed: ${resendError.message}` },
			{ status: 502 }
		);
	}

	return json({ success: true, message: 'Verification email sent. Please check your inbox.' });
};
