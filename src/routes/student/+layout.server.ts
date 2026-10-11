import { formatName } from '$lib/formatting';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { verifySession } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import pool from '$lib/server/db';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');
	if (!token) redirect(302, '/login');

	let payload: { userId: number; role: string };
	try {
		payload = (await verifySession(token!, JWT_SECRET));
	} catch {
		redirect(302, '/login');
	}

	if (payload!.role !== 'Student') redirect(302, '/staff/dashboard');

	const [[rows], [notifRows]] = await Promise.all([
		pool.execute(
			'SELECT first_name, middle_name, last_name, program, student_id, id_status, id_reject_reason FROM users WHERE user_id = ?',
			[payload!.userId]
		),
		pool.execute(
			`SELECT COUNT(*) AS n FROM request_status_history h
			 LEFT JOIN requests r ON h.request_id = r.request_id
			 WHERE (r.student_id = ? OR h.notification_user_id = ?) AND h.student_read = FALSE`,
			[payload!.userId, payload!.userId]
		)
	]);
	const u = (rows as Record<string, unknown>[])[0];
	if (!u) redirect(302, '/login');

	const name = formatName(u.first_name, u.middle_name, u.last_name);
	const initials = `${(u.first_name as string)[0]}${(u.last_name as string)[0]}`.toUpperCase();
	const notifCount = ((notifRows as Record<string, unknown>[])[0].n as number) ?? 0;

	return {
		userId: payload!.userId,
		notifCount,
		layoutUser: {
			name,
			initials,
			program: (u.program as string | null) ?? 'Student',
			studentId: (u.student_id as string | null) ?? ''
			,idStatus: (u.id_status as string) ?? 'pending',
			idRejectReason: (u.id_reject_reason as string | null) ?? null
		}
	};
};
