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

	if (payload!.role === 'Student') redirect(302, '/student/dashboard');

	const [rows] = await pool.execute(
		`SELECT user_id, first_name, middle_name, last_name,
		        email, role, position, date_registered
		 FROM users WHERE user_id = ?`,
		[payload!.userId]
	);

	const users = rows as Record<string, unknown>[];
	if (users.length === 0) redirect(302, '/login');

	const u = users[0];
	const fmt = (d: unknown) =>
		d instanceof Date ? d.toISOString().split('T')[0] : (d as string | null) ?? null;

	const firstName = u.first_name as string;
	const middleName = (u.middle_name as string | null) ?? null;
	const lastName = u.last_name as string;
	const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
	const initials = [firstName, lastName]
		.filter(Boolean)
		.map((n) => n[0])
		.join('')
		.toUpperCase();

	return {
		profile: {
			user_id:         u.user_id as number,
			full_name:       fullName,
			initials,
			first_name:      firstName,
			middle_name:     middleName,
			last_name:       lastName,
			email:           u.email as string,
			role:            u.role as string,
			position:        (u.position as string | null) ?? null,
			date_registered: fmt(u.date_registered)
		}
	};
};
