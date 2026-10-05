import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		redirect(302, '/verify-email?error=invalid_or_expired');
	}

	try {
		const payload = verifyJwt<{ email: string }>(token, JWT_SECRET);
		await pool.execute('UPDATE users SET verified = TRUE WHERE email = ?', [payload.email]);
	} catch {
		// JWT invalid/expired or DB error
		redirect(302, '/verify-email?error=invalid_or_expired');
	}

	// Outside try/catch — only reached if verification succeeded
	redirect(302, '/student/dashboard');
};
