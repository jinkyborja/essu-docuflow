import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { verifyJwt } from '$lib/server/jwt';
import { JWT_SECRET } from '$env/static/private';
import { logActivity } from '$lib/server/activity-log';

export const POST: RequestHandler = async ({ request }) => {
	const { token, firstName, lastName, position, password } = await request.json();

	if (!token || !firstName || !lastName || !password) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	let payload: { email: string; role: string; purpose: string };
	try {
		payload = verifyJwt<{ email: string; role: string; purpose: string }>(token, JWT_SECRET);
	} catch {
		return json({ error: 'Invitation link is invalid or expired' }, { status: 400 });
	}

	if (payload.purpose !== 'staff-invite') {
		return json({ error: 'Invalid invitation token' }, { status: 400 });
	}

	if (!['Staff', 'Admin'].includes(payload.role)) {
		return json({ error: 'Invalid role in invitation' }, { status: 400 });
	}

	const [existing] = await pool.execute('SELECT user_id FROM users WHERE email = ?', [payload.email]);
	if ((existing as unknown[]).length > 0) {
		return json({ error: 'An account with this email already exists' }, { status: 409 });
	}

	const passwordHash = createHash('sha256').update(password).digest('hex');

	const [result] = await pool.execute(
		`INSERT INTO users (first_name, last_name, email, password_hash, role, position, verified)
		 VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
		[firstName, lastName, payload.email, passwordHash, payload.role, position || null]
	);
	const userId = (result as { insertId: number }).insertId;
	try {
		const conn = await pool.getConnection();
		try { await logActivity(conn, { actor: { userId, role: payload.role }, action: 'staff.invite.accepted', entityType: 'staff', entityId: userId, summary: `Created staff account #${userId} from invitation`, details: { changedFields: ['staff account', 'role', 'password'] } }); }
		finally { conn.release(); }
	} catch (error) { console.error('Could not write staff invitation acceptance activity:', error); }

	return json({ success: true });
};
