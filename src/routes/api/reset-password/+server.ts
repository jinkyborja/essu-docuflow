import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
	const { token, password } = await request.json();
	if (!token || !password) return json({ error: 'Missing fields' }, { status: 400 });
	if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, { status: 400 });

	let payload: { email: string; purpose: string };
	try {
		payload = verifyJwt<{ email: string; purpose: string }>(token, JWT_SECRET);
	} catch {
		return json({ error: 'Reset link is invalid or has expired' }, { status: 400 });
	}

	if (payload.purpose !== 'reset') {
		return json({ error: 'Invalid reset token' }, { status: 400 });
	}

	const passwordHash = createHash('sha256').update(password).digest('hex');
	const [result] = await pool.execute(
		'UPDATE users SET password_hash = ? WHERE email = ?',
		[passwordHash, payload.email]
	);

	if ((result as { affectedRows: number }).affectedRows === 0) {
		return json({ error: 'No account found for this email' }, { status: 404 });
	}

	return json({ success: true });
};
