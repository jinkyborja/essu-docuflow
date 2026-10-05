import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/login');

	let payload: { userId: number; role: string };
	try {
		payload = verifyJwt<{ userId: number; role: string }>(token, JWT_SECRET);
	} catch {
		redirect(302, '/login');
	}

	if (payload.role !== 'Student') redirect(302, '/staff/dashboard');

	const [rows] = await pool.execute(
		`SELECT first_name, middle_name, last_name, suffix, date_of_birth,
		        email, student_id, program, student_type, last_school_year,
		        date_registered
		 FROM users WHERE user_id = ?`,
		[payload.userId]
	);

	const users = rows as Record<string, unknown>[];
	if (users.length === 0) redirect(302, '/login');

	const u = users[0];

	const fmt = (d: unknown) =>
		d instanceof Date ? d.toISOString().split('T')[0] : (d as string | null) ?? null;

	return {
		profile: {
			first_name:      u.first_name as string,
			middle_name:     (u.middle_name as string | null) ?? null,
			last_name:       u.last_name as string,
			suffix:          (u.suffix as string | null) ?? null,
			date_of_birth:   fmt(u.date_of_birth),
			email:           u.email as string,
			student_id:      u.student_id as string,
			program:         u.program as string,
			student_type:    u.student_type as string | null,
			last_school_year: u.last_school_year as number | null,
			date_registered:  fmt(u.date_registered)
		}
	};
};
