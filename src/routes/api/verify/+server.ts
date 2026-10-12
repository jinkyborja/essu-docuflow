import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { logActivity } from '$lib/server/activity-log';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		redirect(302, '/verify-email?error=invalid_or_expired');
	}

	try {
		const payload = verifyJwt<Record<string, unknown>>(token, JWT_SECRET);
		// Previously emailed verification links had no purpose or session identity.
		const legacyVerification = payload.purpose === undefined && payload.userId === undefined && payload.role === undefined;
		if (
			(payload.purpose !== 'email-verification' && !legacyVerification) ||
			typeof payload.email !== 'string' || !payload.email.trim()
		) throw new Error('Invalid verification token');
		const [users] = await pool.execute('SELECT user_id, role FROM users WHERE email = ?', [payload.email]);
		const user = (users as Array<{ user_id: number; role: string }>)[0];
		const [result] = await pool.execute('UPDATE users SET verified = TRUE WHERE email = ?', [payload.email]);
		if (user && (result as { affectedRows: number }).affectedRows > 0) {
			try {
				const conn = await pool.getConnection();
				try { await logActivity(conn, { actor: { userId: user.user_id, role: user.role }, action: 'account.email.verified', entityType: 'account', entityId: user.user_id, summary: `Verified email for account #${user.user_id}`, details: { changedFields: ['verified'] } }); }
				finally { conn.release(); }
			} catch (error) { console.error('Could not write email verification activity:', error); }
		}
	} catch {
		// JWT invalid/expired or DB error
		redirect(302, '/verify-email?error=invalid_or_expired');
	}

	// Outside try/catch — only reached if verification succeeded
	redirect(302, '/student/dashboard');
};
