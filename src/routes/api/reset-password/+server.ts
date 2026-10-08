import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
	const { token, password } = await request.json();
	if (typeof token !== 'string' || typeof password !== 'string' || !token || !password) return json({ error: 'Missing fields' }, { status: 400 });
	if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, { status: 400 });

	let payload: { email: string; purpose: string; authVersion: number };
	try {
		payload = verifyJwt<typeof payload>(token, JWT_SECRET);
	} catch {
		return json({ error: 'Reset link is invalid or has expired' }, { status: 400 });
	}

	if (payload.purpose !== 'reset' || typeof payload.email !== 'string' || !Number.isSafeInteger(payload.authVersion) || payload.authVersion < 0) {
		return json({ error: 'Invalid reset token' }, { status: 400 });
	}

	const passwordHash = createHash('sha256').update(password).digest('hex');
	const [result] = await pool.execute(
		'UPDATE users SET password_hash = ?, auth_version = auth_version + 1 WHERE email = ? AND auth_version = ?',
		[passwordHash, payload.email, payload.authVersion]
	);

	if ((result as { affectedRows: number }).affectedRows === 0) {
		return json({ error: 'Reset link is invalid or has already been used' }, { status: 400 });
	}

	return json({ success: true });
};
