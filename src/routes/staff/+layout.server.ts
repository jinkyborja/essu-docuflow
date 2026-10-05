import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import pool from '$lib/server/db';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/login');

	let payload: { userId: number; role: string };
	try {
		payload = verifyJwt<{ userId: number; role: string }>(token!, JWT_SECRET);
	} catch {
		redirect(302, '/login');
	}

	if (payload!.role === 'Student') redirect(302, '/student/dashboard');

	const [[rows], [notifRows]] = await Promise.all([
		pool.execute(
			'SELECT first_name, last_name, position FROM users WHERE user_id = ?',
			[payload!.userId]
		),
		pool.execute(
			`SELECT COUNT(*) AS n FROM requests r
			 WHERE r.status = 'Pending'
			   AND r.staff_viewed = FALSE
			   AND NOT EXISTS (SELECT 1 FROM request_status_history h WHERE h.request_id = r.request_id)`
		)
	]);
	const u = (rows as Record<string, unknown>[])[0];
	if (!u) redirect(302, '/login');

	const name = `${u.first_name} ${u.last_name}`;
	const initials = `${(u.first_name as string)[0]}${(u.last_name as string)[0]}`.toUpperCase();
	const notifCount = ((notifRows as Record<string, unknown>[])[0].n as number) ?? 0;

	return {
		userId: payload!.userId,
		role: payload!.role,
		notifCount,
		layoutUser: {
			name,
			initials,
			position: (u.position as string | null) ?? 'Staff'
		}
	};
};
